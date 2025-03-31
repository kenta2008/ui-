import * as server from "@minecraft/server";
import * as ui from "@minecraft/server-ui";

// 必要なアイテム数
const swordRequirements = {
    "wooden_sword": { "minecraft:iron_ingot": 5 },
    "stone_sword": { "minecraft:iron_ingot": 20 },
    "iron_sword": { "minecraft:gold_ingot": 15 },
    "diamond_sword": { "minecraft:diamond": 15 },
    "netherite_sword": { "minecraft:diamond": 35, "minecraft:emerald": 3 }
};

const pickaxeRequirements = {
    "wooden_pickaxe": { "minecraft:iron_ingot": 5 },
    "stone_pickaxe": { "minecraft:iron_ingot": 20 },
    "iron_pickaxe": { "minecraft:gold_ingot": 15 },
    "diamond_pickaxe": { "minecraft:diamond": 15 },
    "netherite_pickaxe": { "minecraft:diamond": 35, "minecraft:emerald": 3 }
};

const foodRequirements = {
    "apple": { "minecraft:iron_ingot": 10 },
    "cooked_beef": { "minecraft:iron_ingot": 30 },
    "golden_carrot": { "minecraft:gold_ingot": 15 },
    "cooked_chicken": { "minecraft:diamond": 5 },
};

// 各カテゴリのアイテムテクスチャ
const swordTextures = ["textures/items/wood_sword", "textures/items/stone_sword", "textures/items/iron_sword", "textures/items/diamond_sword", "textures/items/netherite_sword"];
const pickaxeTextures = ["textures/items/wood_pickaxe", "textures/items/stone_pickaxe", "textures/items/iron_pickaxe", "textures/items/diamond_pickaxe", "textures/items/netherite_pickaxe"];
const foodTextures = ["textures/items/apple", "textures/items/beef_cooked", "textures/items/carrot_golden", "textures/items/chicken_cooked"];

// インベントリ内の特定アイテムの数を取得
function getItemCount(player, itemId) {
    const inventory = player.getComponent("minecraft:inventory").container;
    let totalCount = 0;
    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (item && item.typeId === itemId) {
            totalCount += item.amount;
        }
    }
    return totalCount;
}

// 必要アイテムを持っているか確認
function canAfford(player, toolType, type) {
    const requirements = type === "sword" ? swordRequirements[toolType] :
                         type === "pickaxe" ? pickaxeRequirements[toolType] :
                         foodRequirements[toolType];

    for (const [item, amount] of Object.entries(requirements)) {
        if (getItemCount(player, item) < amount) {
            return false;
        }
    }
    return true;
}

// 必要アイテムを消費する
function deductItems(player, toolType, type) {
    const requirements = type === "sword" ? swordRequirements[toolType] :
                         type === "pickaxe" ? pickaxeRequirements[toolType] :
                         foodRequirements[toolType];

    const inventory = player.getComponent("minecraft:inventory").container;
    for (const [item, amountNeeded] of Object.entries(requirements)) {
        let amountToDeduct = amountNeeded;
        for (let i = 0; i < inventory.size; i++) {
            const slot = inventory.getItem(i);
            if (slot && slot.typeId === item) {
                if (slot.amount > amountToDeduct) {
                    slot.amount -= amountToDeduct;
                    inventory.setItem(i, slot);
                    break;
                } else {
                    amountToDeduct -= slot.amount;
                    inventory.setItem(i, undefined);
                }
            }
        }
    }
}

// メニュー
function menu(player) {
    const form = new ui.ActionFormData();
    form.title("選択")
        .body("メニューを選択してください")
        .button("剣", "textures/items/wood_sword")
        .button("ピッケル", "textures/items/wood_pickaxe")
        .button("食料", "textures/items/chicken_cooked")
        .button("ポーション", "textures/items/potion_bottle_healthBoost");

    form.show(player).then((response) => {
        if (response.canceled) return;
        if (response.selection === 0) sword(player);
        if (response.selection === 1) pickaxe(player);
        if (response.selection === 2) food(player);
        if (response.selection === 3) {
            player.sendMessage("ポーション機能は未実装です！");
        }
    });
}

// ピッケル購入
function pickaxe(player) {
    handlePurchase(player, pickaxeRequirements, pickaxeTextures, "pickaxe");
}

// 剣購入
function sword(player) {
    handlePurchase(player, swordRequirements, swordTextures, "sword");
}

// 食料購入
function food(player) {
    handlePurchase(player, foodRequirements, foodTextures, "food");
}

// 購入処理共通化
function handlePurchase(player, requirements, textures, type) {
    const form = new ui.ActionFormData();
    form.title(type === "sword" ? "剣を購入" : type === "pickaxe" ? "ピッケルを購入" : "食料を購入")
        .body("必要なアイテムを持っていると交換できます。");

    Object.keys(requirements).forEach((tool, index) => {
        let buttonText = tool.replace("_", " ");
        if (canAfford(player, tool, type)) {
            buttonText += " §a(アイテム受け取り可)";
        } else {
            let missingText = " (あと";
            let first = true;
            for (const [item, amount] of Object.entries(requirements[tool])) {
                const missing = amount - getItemCount(player, item);
                if (missing > 0) {
                    if (!first) missingText += "・";
                    missingText += `§c${missing}§r`;
                    first = false;
                }
            }
            missingText += "個必要)";
            buttonText += missingText;
        }
        form.button(buttonText, textures[index]);
    });

    form.show(player).then((response) => {
        if (response.canceled) return;

        const selectedTool = Object.keys(requirements)[response.selection];
        if (!canAfford(player, selectedTool, type)) {
            player.sendMessage("§c必要なアイテムが足りません！");
            return;
        }

        deductItems(player, selectedTool, type);
        player.runCommandAsync(`give @s minecraft:${selectedTool}`);
        player.sendMessage(`§a${selectedTool.replace("_", " ")} を購入しました！`);
    });
}



// アイテム使用時のイベント
server.world.afterEvents.itemUse.subscribe(ev => {
    if (!ev.source || !(ev.source instanceof server.Player)) return;
    const itemId = ev.itemStack.typeId;
    if (itemId === "minecraft:stick") sword(ev.source);
    if (itemId === "minecraft:stone") pickaxe(ev.source);
    if (itemId === "minecraft:compass") menu(ev.source);
    if (itemId === "minecraft:sand") food(ev.source);
});
