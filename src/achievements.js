const { canvas } = require('gameConstants');
const Rectangle = require('Rectangle');
const { drawRectangle, drawText, drawImage, measureText } = require('draw');
const { playSound } = require('state');
const { requireImage, r, createAnimation, } = require('animations');

const ACHIEVEMENT_COLLECT_X_CRYSTALS = 'collectXCrystals';
const ACHIEVEMENT_COLLECT_X_CRYSTALS_IN_ONE_DAY = 'collectXCrystalsInOneDay';
const ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY ='gainXBonusFuelInOneDay';
const ACHIEVEMENT_DIFFUSE_X_BOMBS = 'diffuseXBombs';
const ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY = 'diffuseXBombsInOneDay';
const ACHIEVEMENT_PREVENT_X_EXPLOSIONS = 'preventXExplosions';
const ACHIEVEMENT_EXPLORE_DEPTH_X = 'exploreDepthX';
const ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS = 'repairShipInXDays';

const diamondMedalFrame = {
    image: requireImage('gfx/achievements.png'),
    left: 156,
    top: 0,
    width: 39,
    height: 39,
};
const goldMedalFrame = {...diamondMedalFrame, left: 78};
const silverMedalFrame = {...diamondMedalFrame, left: 39};
const bronzeMedalFrame = {...diamondMedalFrame, left: 0};

const achievementAnimation = createAnimation('gfx/achievements.png', r(39, 39),
    {x: 2, cols: 2, duration: 20, frameMap:[0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]},
    {loop: false}
);

module.exports = {
    initializeAchievements,
    advanceAchievements,
    renderAchievements,
    getAchievementBonus,
    getAchievementPercent,
    getAchievementStat,
    setAchievementStatIfBetter,
    incrementAchievementStat,
    ACHIEVEMENT_COLLECT_X_CRYSTALS,
    ACHIEVEMENT_COLLECT_X_CRYSTALS_IN_ONE_DAY,
    ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY,
    ACHIEVEMENT_DIFFUSE_X_BOMBS,
    ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY,
    ACHIEVEMENT_PREVENT_X_EXPLOSIONS,
    ACHIEVEMENT_EXPLORE_DEPTH_X,
    ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS,
    achievementAnimation,
};

const { addSprite, deleteSprite, updateSprite } = require('sprites');
const { warpDriveSlots, renderSpaceBackground } = require('ship');
const ACHIEVEMENT_ICON_FRAMES = [bronzeMedalFrame, silverMedalFrame, goldMedalFrame, diamondMedalFrame];

// steamKeysToGameKeys['ACHIEVEMENT_COLLECT_X_CRYSTALS'] is 'collectXCrystals'
const steamKeysToGameKeys = {
    ACHIEVEMENT_COLLECT_X_CRYSTALS,
    ACHIEVEMENT_COLLECT_X_CRYSTALS_IN_ONE_DAY,
    ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY,
    ACHIEVEMENT_DIFFUSE_X_BOMBS,
    ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY,
    ACHIEVEMENT_PREVENT_X_EXPLOSIONS,
    ACHIEVEMENT_EXPLORE_DEPTH_X,
    ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS,
};
// gameKeysToSteamKeys['collectXCrystals'] is 'ACHIEVEMENT_COLLECT_X_CRYSTALS'
const gameKeysToSteamKeys = {};
for (let key in steamKeysToGameKeys) {
    gameKeysToSteamKeys[steamKeysToGameKeys[key]] = key;
}

const achievementsData = {
    [ACHIEVEMENT_COLLECT_X_CRYSTALS]: {
        goals: [500, 20000, 100000, 10000000],
        bonusValues: [25, 50, 75, 100],
        getAchievementLabel: goal => `Collect ${goal} crystals`,
        getBonusLabel: bonusValue => `Gain ${bonusValue}% more crystals`,
        getValue: state => getAchievementStat(state, ACHIEVEMENT_COLLECT_X_CRYSTALS),
        valueIsBetter: (value, goal) => value > goal,
    },
    [ACHIEVEMENT_COLLECT_X_CRYSTALS_IN_ONE_DAY]: {
        goals: [100, 5000, 250000, 12500000],
        bonusValues: [10, 20, 30, 40],
        getAchievementLabel: goal => `Collect ${goal} crystals in 1 day`,
        // This may increase your effective range when it triggers in your outer ring.
        getBonusLabel: bonusValue => `${bonusValue}% chance to reveal bonus information`,
        getValue: state => state.saved.crystalsCollectedToday,
        valueIsBetter: (value, goal) => value > goal,
    },
    [ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY]: {
        goals: [50, 500, 5000, 50000],
        bonusValues: [25, 50, 75, 100],
        getAchievementLabel: goal => `Gain ${goal} bonus fuel in one day`,
        getBonusLabel: bonusValue => `${bonusValue}% more fuel capacity`,
        getValue: state => state.saved.bonusFuelToday,
        valueIsBetter: (value, goal) => value > goal,
    },
    [ACHIEVEMENT_DIFFUSE_X_BOMBS]: {
        goals: [5, 20, 100, 200],
        bonusValues: [50, 100, 150, 200],
        getAchievementLabel: goal => `Extract energy from debris ${goal} times`,
        getBonusLabel: bonusValue => `Gain ${bonusValue}% extra energy extracted from debris`,
        getValue: state => getAchievementStat(state, ACHIEVEMENT_DIFFUSE_X_BOMBS),
        valueIsBetter: (value, goal) => value > goal,
    },
    [ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY]: {
        goals: [5, 10, 15, 20],
        bonusValues: [1, 2, 3, 5],
        getAchievementLabel: goal => `Extract energy from debris ${goal} times in one day`,
        getBonusLabel: bonusValue => `${bonusValue} extra Energy Extractors`,
        getValue: state => state.saved.bombsDiffusedToday,
        valueIsBetter: (value, goal) => value > goal,
    },
    [ACHIEVEMENT_PREVENT_X_EXPLOSIONS]: {
        goals: [10, 50, 100, 200],
        bonusValues: [10, 20, 25, 30],
        getAchievementLabel: goal => `Shield yourself from ${goal} debris explosions`,
        getBonusLabel: bonusValue => `${bonusValue}% increased maximum explosion protection`,
        getValue: state => getAchievementStat(state, ACHIEVEMENT_PREVENT_X_EXPLOSIONS),
        valueIsBetter: (value, goal) => value > goal,
    },
    [ACHIEVEMENT_EXPLORE_DEPTH_X]: {
        goals: [20, 50, 100, 150],
        bonusValues: [20, 50, 100, 150],
        getAchievementLabel: goal => `Explore depth ${goal}`,
        getBonusLabel: bonusValue => `Start from depth ${bonusValue}`,
        getValue: state => state.saved.maxDepth,
        valueIsBetter: (value, goal) => value > goal,
    },
    [ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS]: {
        goals: [100, 50, 25, 5],
        bonusValues: [50, 100, 150, 200],
        getAchievementLabel: goal => `Repair ship by day ${goal}`,
        getBonusLabel: bonusValue => `Gain ${bonusValue}% more bonus fuel`,
        getValue: state => ((state.saved.shipPart >= warpDriveSlots.length) && state.saved.day),
        valueIsBetter: (value, goal) => value < goal,
    },
};

function updateAchievement(state, key) {
    const data = achievementsData[key];
    state = setAchievementStatIfBetter(state, key, data.getValue(state));
    const value = getAchievementStat(state, key);
    // Update the bonus level for this achievement, if necessary.
    let bonusLevel = -1, goal = data.goals[bonusLevel + 1];
    // while (data.goals[bonusLevel + 1]) {
    while (data.goals[bonusLevel + 1] && value && (value === goal || data.valueIsBetter(value, goal))) {
        bonusLevel++;
        goal = data.goals[bonusLevel + 1];
    }
    if (state.achievements[key] !== bonusLevel) {
        state = {...state, achievements: {...state.achievements, [key]: bonusLevel}};
    }
    return state;
}
function setAchievementStatIfBetter(state, key, value) {
    const savedValue = getAchievementStat(state, key);
    if (value && (!savedValue || achievementsData[key].valueIsBetter(value, savedValue))) {
        state = setAchievementStat(state, key, value);
    }
    return state;
}
function incrementAchievementStat(state, key, amount) {
    return setAchievementStat(state, key, getAchievementStat(state, key) + amount);
}
function setAchievementStat(state, key, value) {
    const achievementStats = {...state.saved.achievementStats, [key]: value};
    return {...state, saved: {...state.saved, achievementStats}};
}
function getAchievementStat(state, key) {
    const achievementStats = state.saved.achievementStats || {};
    return achievementStats[key] || false;
}
function getAchievementBonus(state, key) {
    const bonusValue = (state.achievements || {})[key];
    return bonusValue >= 0 && achievementsData[key].bonusValues[bonusValue];
}

// Sets state.steamAchievements
// eslint-disable-next-line no-unused-vars
function initializeAchievementsSteam(state) {
    state = {...state, steamAchievements: {}};
    for (let key in achievementsData) {
        for (let i = 0; i < achievementsData[key].goals.length; i++) {
            const bonusLevel = i+1;
            const tempKey = 'ACHIEVEMENT_' + key.split(/(?=[A-Z])/).join('_').toUpperCase() + '_' + bonusLevel;
            window.steamAPI.steamFetchSteamAchievement(tempKey)
                .then((isAchieved)=> state.steamAchievements[tempKey] = isAchieved);
        }
    }
    return state;
}
// for development and testing
// window.callInitializeAchievementsSteam = (state) => initializeAchievementsSteam(state)

// eslint-disable-next-line no-unused-vars
function fetchAchievementSteam (key, bonusLevel) {
    const steamKeyType = gameKeysToSteamKeys[key];
    const steamKey = steamKeyType + '_' + bonusLevel;
    const isAchieved = window.steamAPI.steamFetchSteamAchievement(steamKey);
    return isAchieved;
}
// for development and testing
// window.callFetchAchievementSteam = (key, bonusLevel) => fetchAchievementSteam(key, bonusLevel)

// eslint-disable-next-line no-unused-vars
function clearAllAchievementsSteam(state) {
    state = {...state};
    for (let key in achievementsData) {
        for (let i = 0; i < achievementsData[key].goals.length; i++) {
            const bonusLevel = i+1;
            const steamKeyType = gameKeysToSteamKeys[key];
            const steamKey = steamKeyType + '_' + bonusLevel;
            window.steamAPI.steamClearSteamAchievement(steamKey)
                .then((isCleared)=> {
                    if (isCleared) state.steamAchievements[steamKey] = false;
                });
        }
    }
    return state;
}
// for development and testing
// window.callClearAllAchievementsSteam = (state) => clearAllAchievementsSteam(state)

// Sets state.achievements and state.saved.achievementStats if necessary.
function initializeAchievements(state) {
    state = {...state, achievements: {}};
    for (let key in achievementsData) state = updateAchievement(state, key);
    return state;
}
function getAchievementPercent(state, saveData) {
    state = initializeAchievements({...state, saved: saveData});
    let total = 0, unlocked = 0;
    for (let key in achievementsData) {
        total += 4;
        unlocked += (state.achievements[key] + 1);
    }
    return unlocked / total;
}

function advanceAchievements(state) {
    if (!state.achievements) return initializeAchievements(state);
    if (window.steamAPI && !state.steamAchievements) return initializeAchievementsSteam(state);
    for (let key in achievementsData) {
        const data = achievementsData[key];
        let bonusLevel = state.achievements[key];
        state = updateAchievement(state, key);
        if (bonusLevel < state.achievements[key]) {
            bonusLevel = state.achievements[key];
            let lastAchievement = state.spriteMap[state.lastAchievementId];
            const achievement = {
                ...achievementSprite,
                color: '#C84',
                bonusLevel,
                label: data.getAchievementLabel(data.goals[bonusLevel]),
                y: lastAchievement ? Math.max(lastAchievement.y + lastAchievement.height + 10, canvas.height + 10) : canvas.height + 10,
            };
            achievement.textWidth = measureText(state.context, achievement.label, achievement.textProperties);
            achievement.width = achievement.textWidth + 72;
            achievement.x = canvas.width - 10 - achievement.width;
            state = addSprite(state, achievement);
            playSound(state, 'achievement');
            // This is a null op if lastAchievement is not set or is no longer present.
            state = updateSprite(state, {id: state.lastAchievementId}, {nextAchievementId: achievement.id});
            state = {...state, lastAchievementId: achievement.id, lastAchievementTime: state.time};

            if (window.steamAPI) {
                // bonusLevel goes from -1 (no achievement) to 0 (first achievement) and up
                for (let steamKeyLevel = 1; steamKeyLevel <= bonusLevel+1; steamKeyLevel++) {
                    const steamKeyType = gameKeysToSteamKeys[key];
                    const steamKey = steamKeyType + '_' + steamKeyLevel;
                    const hasAchievedSteamLevel = state.steamAchievements[steamKey];
                    if (hasAchievedSteamLevel) {
                        continue;
                    }
                    window.steamAPI.steamFetchSteamAchievement(steamKey)
                    .then((response) => {
                        if (response) {
                            initializeAchievementsSteam(state);
                            return;
                        }
                        window.steamAPI.steamSetSteamAchievement(steamKey);
                    });
                }
            }
        }

    }
    return state;
}

function renderAchievementBackground(context, state, achievement) {
    const rectangle = achievement.getRectangle(state, achievement);
    drawRectangle(context, rectangle, {fillStyle: achievement.color});
    drawRectangle(context, rectangle.pad(-1), {strokeStyle: 'black', lineWidth: 4});
    drawRectangle(context, rectangle, {strokeStyle: 'white', lineWidth: 2});
    drawRectangle(context, rectangle.pad(-5), {strokeStyle: 'white', lineWidth: 2});
}

const achievementSprite = {
    type: 'achievement',
    textProperties: {fillStyle: 'white', textAlign: 'left', textBaseline: 'middle', size: 24},
    advance(state, sprite) {
        let {frame = 0, x = canvas.width - sprite.width - 10, y = canvas.height + 10, nextAchievementId} = sprite;
        if (frame > 150) return deleteSprite(state, sprite);
        const nextAchievement = state.spriteMap[nextAchievementId];
        if (nextAchievement) {
            // If the next achievement is coming up move this achievement up out of the way.
            y = Math.min(y, nextAchievement.y - 15 - sprite.height);
        } else if (y > canvas.height - sprite.height - 10) {
            // Move the achievement sprite up until it is fully on screen.
            y -= 6;
        }
        if (frame > 100) {
            // Move the achievement to the right off the edge of the screen before we delete it.
            x += 10;
        }
        frame++;
        return updateSprite(state, sprite, {frame, x, y});
    },
    getRectangle(state, sprite) {
        return new Rectangle(sprite.x, sprite.y, sprite.width, sprite.height);
    },
    render(context, state, sprite) {
        const rectangle = sprite.getRectangle(state, sprite);
        renderAchievementBackground(context, state, sprite);
        const iconFrame = ACHIEVEMENT_ICON_FRAMES[sprite.bonusLevel];
        const target = new Rectangle(iconFrame);
        drawImage(context, iconFrame.image, iconFrame,
            target.moveCenterTo(rectangle.left + 15 + target.width / 2, rectangle.top + rectangle.height / 2)
        );
        drawText(context, sprite.label, rectangle.left + 25 + target.width, rectangle.top + rectangle.height / 2,
            sprite.textProperties
        );
    },
    height: 80,
    width: 300,
    renderOverHud: true,
};

function renderAchievements(context, state) {
    //context.fillStyle = '#08F';
    //context.fillRect(0, 0, canvas.width, canvas.height);
    renderSpaceBackground(context, state);
    const achievementKeys = Object.keys(achievementsData);
    const padding = Math.round(Math.min(canvas.width, canvas.height) / 40);
    const rowHeight = Math.round((canvas.height - 40 - 4 * padding) / achievementKeys.length);
    const size = Math.round(Math.min(rowHeight * 0.5, canvas.width / 35));
    const smallSize = Math.round(size * 0.8);
    let iconScale = 0.5;
    if (rowHeight >= 30) iconScale += 0.25;
    if (rowHeight >= 36) iconScale += 0.25;
    const middle = Math.round(180 * iconScale);
    let top = padding;
    for (const key of achievementKeys) {
        const data = achievementsData[key];
        const bonusLevel = state.achievements[key];
        context.save();
        for (let i = 0; i < data.bonusValues.length; i++) {
            const iconFrame = ACHIEVEMENT_ICON_FRAMES[i];
            context.globalAlpha = (i <= bonusLevel) ? 1 : 0.25 - 0.05 * i;
            const target = new Rectangle(iconFrame).scale(iconScale);
            drawImage(context, iconFrame.image, iconFrame,
                target.moveCenterTo(middle - (4-i) * (target.width + 2) + target.width / 2, top + rowHeight / 2)
            );
        }
        context.restore();
        let goalValue = (getAchievementStat(state, key) || 0)
        if (bonusLevel + 1 < data.goals.length) {
            goalValue += ' / ' + data.goals[bonusLevel + 1];
        }
        const textHeight = size + smallSize;
        const textTop = top + rowHeight / 2 - textHeight / 2;
        drawText(context, data.getAchievementLabel(goalValue), middle + 10, textTop + size / 2,
            {fillStyle: 'white', textAlign: 'left', textBaseline: 'middle', size}
        );
        if (bonusLevel >= 0) {
            drawText(context, data.getBonusLabel(data.bonusValues[bonusLevel]), middle + 10, textTop + size + smallSize / 2,
                {fillStyle: '#F84', textAlign: 'left', textBaseline: 'middle', size: smallSize}
            );
        }
        top += rowHeight;
    }
}
