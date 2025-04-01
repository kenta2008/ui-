import * as server from "@minecraft/server";
import * as ui from "@minecraft/server-ui";

// 必要なアイテムリスト
const itemRequirements = {
    sword: {
        "wooden_sword": { "minecraft:iron_ingot": 5 },
        "stone_sword": { "minecraft:iron_ingot": 20 },
        "iron_sword": { "minecraft:gold_ingot": 15 },
        "diamond_sword": { "minecraft:diamond": 15 },
        "netherite_sword": { "minecraft:diamond": 35, "minecraft:emerald": 3 }
    },
    pickaxe: {
        "wooden_pickaxe": { "minecraft:iron_ingot": 5 },
        "stone_pickaxe": { "minecraft:iron_ingot": 20 },
        "iron_pickaxe": { "minecraft:gold_ingot": 15 },
        "diamond_pickaxe": { "minecraft:diamond": 15 },
        "netherite_pickaxe": { "minecraft:diamond": 35, "minecraft:emerald": 3 }
    },
    food: {
        "apple": { "minecraft:iron_ingot": 10 },
        "cooked_beef": { "minecraft:iron_ingot": 30 },
        "golden_carrot": { "minecraft:gold_ingot": 15 },
        "cooked_chicken": { "minecraft:diamond": 5 }
    }
};

// アイテムのテクスチャ
const itemTextures = {
    sword: ["textures/items/wood_sword", "textures/items/stone_sword", "textures/items/iron_sword", "textures/items/diamond_sword", "textures/items/netherite_sword"],
    pickaxe: ["textures/items/wood_pickaxe", "textures/items/stone_pickaxe", "textures/items/iron_pickaxe", "textures/items/diamond_pickaxe", "textures/items/netherite_pickaxe"],
    food: ["textures/items/apple", "textures/items/beef_cooked", "textures/items/carrot_golden", "textures/items/chicken_cooked"]
};

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
function getMissingItems(player, toolType, type) {
    const requirements = itemRequirements[type][toolType];
    let missingItems = {};

    for (const [item, amount] of Object.entries(requirements)) {
        const missing = amount - getItemCount(player, item);
        if (missing > 0) {
            missingItems[item] = missing;
        }
    }
    return missingItems;
}

// 必要アイテムを消費する
function deductItems(player, toolType, type) {
    const requirements = itemRequirements[type][toolType];
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

function menu(player) {
    try {
        server.system.run(() => {
            const form = new ui.ActionFormData();
            form.title("選択")
                .body("メニューを選択してください")
                .button("剣", "textures/items/wood_sword")
                .button("ピッケル", "textures/items/wood_pickaxe")
                .button("食料", "textures/items/chicken_cooked")
                .button("ポーション", "textures/items/potion_bottle_healthBoost");

            form.show(player).then((response) => {
                if (response.canceled) return;
                switch (response.selection) {
                    case 0: handlePurchase(player, "sword"); break;
                    case 1: handlePurchase(player, "pickaxe"); break;
                    case 2: handlePurchase(player, "food"); break;
                    case 3: player.sendMessage("ポーション機能は未実装です！"); break;
                }
            });
        });
    } catch (error) {
        console.error("メニュー表示エラー:", error);
    }
}

// 購入処理共通化
function handlePurchase(player, type) {
    try {
        const form = new ui.ActionFormData();
        form.title(type === "sword" ? "剣を購入" : type === "pickaxe" ? "ピッケルを購入" : "食料を購入")
            .body("必要なアイテムを持っていると交換できます。");

        Object.keys(itemRequirements[type]).forEach((tool, index) => {
            let buttonText = tool.replace("_", " ");
            const missingItems = getMissingItems(player, tool, type);
            
            if (Object.keys(missingItems).length === 0) {
                buttonText += " §a(アイテム受け取り可)";
            } else {
                let missingText = " (あと";
                missingText += Object.entries(missingItems).map(([item, amount]) => `§c${amount}§r`).join("・");
                missingText += "個必要)";
                buttonText += missingText;
            }
            form.button(buttonText, itemTextures[type][index]);
        });

        form.show(player).then((response) => {
            if (response.canceled) return;

            const selectedTool = Object.keys(itemRequirements[type])[response.selection];
            if (Object.keys(getMissingItems(player, selectedTool, type)).length > 0) {
                player.sendMessage("§c必要なアイテムが足りません！");
                return;
            }

            deductItems(player, selectedTool, type);
            player.runCommandAsync(`give @s minecraft:${selectedTool}`);
            player.sendMessage(`§a${selectedTool.replace("_", " ")} を購入しました！`);
        });
    } catch (error) {
        console.error("購入処理エラー:", error);
    }
}

// イベント登録
server.world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
    if (ev.target.typeId === "minecraft:armor_stand") {
        menu(ev.player);
    }
});

server.world.afterEvents.itemUse.subscribe(ev => {
    if (!ev.source || !(ev.source instanceof server.Player)) return;
    const itemActions = {
        "minecraft:stick": "sword",
        "minecraft:stone": "pickaxe",
        "minecraft:compass": "menu",
        "minecraft:sand": "food"
    };
    if (itemActions[ev.itemStack.typeId]) {
        itemActions[ev.itemStack.typeId] === "menu" ? menu(ev.source) : handlePurchase(ev.source, itemActions[ev.itemStack.typeId]);
    }
});
