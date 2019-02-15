const { canvas } = require('gameConstants');
const Rectangle = require('Rectangle');
const { drawRectangle, drawText, drawImage, measureText } = require('draw');
const { requireImage } = require('animations');

const FINAL_DEPTH_GOAL = 200;

// const ACHIEVEMENT_LEVELS = ['Bronze', 'Silver', 'Gold', 'Crystal'];


const ACHIEVEMENT_COLLECT_X_CRYSTALS = 'collectXCrystals';
const ACHIEVEMENT_COLLECT_X_CRYSTALS_IN_ONE_DAY = 'collectXCrystalsInOneDay';
const ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY ='gainXBonusFuelInOneDay';
const ACHIEVEMENT_DIFFUSE_X_BOMBS = 'diffuseXBombs';
const ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY = 'diffuseXBombsInOneDay';
const ACHIEVEMENT_PREVENT_X_EXPLOSIONS = 'preventXExplosions';
const ACHIEVEMENT_EXPLORE_DEPTH_X = 'exploreDepthX';
const ACHIEVEMENT_EXPLORED_DEEP_IN_X_DAYS = 'exploredDeepInXDays';
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
        getValue: state => state.crystalsCollectedToday,
        valueIsBetter: (value, goal) => value > goal,
    },
    [ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY]: {
        goals: [50, 500, 5000, 50000],
        bonusValues: [25, 50, 75, 100],
        getAchievementLabel: goal => `Gain ${goal} bonus fuel in one day`,
        getBonusLabel: bonusValue => `${bonusValue}% more fuel capacity`,
        getValue: state => state.bonusFuelToday,
        valueIsBetter: (value, goal) => value > goal,
    },
    [ACHIEVEMENT_DIFFUSE_X_BOMBS]: {
        goals: [5, 20, 100, 200],
        bonusValues: [50, 100, 150, 200],
        getAchievementLabel: goal => `Diffuse ${goal} bombs`,
        getBonusLabel: bonusValue => `Gain ${bonusValue}% extra fuel from diffused bombs`,
        getValue: state => getAchievementStat(state, ACHIEVEMENT_DIFFUSE_X_BOMBS),
        valueIsBetter: (value, goal) => value > goal,
    },
    [ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY]: {
        goals: [5, 10, 15, 20],
        bonusValues: [1, 2, 3, 5],
        getAchievementLabel: goal => `Diffuse ${goal} bombs in one day`,
        getBonusLabel: bonusValue => `${bonusValue} extra bomb diffusers`,
        getValue: state => state.bombsDiffusedToday,
        valueIsBetter: (value, goal) => value > goal,
    },
    [ACHIEVEMENT_PREVENT_X_EXPLOSIONS]: {
        goals: [10, 50, 100, 200],
        bonusValues: [10, 20, 25, 30],
        getAchievementLabel: goal => `Prevent ${goal} bomb explosions`,
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
    [ACHIEVEMENT_EXPLORED_DEEP_IN_X_DAYS]: {
        goals: [100, 50, 25, 5],
        bonusValues: [50, 100, 150, 200],
        getAchievementLabel: goal => `Explore depth ${FINAL_DEPTH_GOAL} by day ${goal}`,
        getBonusLabel: bonusValue => `Gain ${bonusValue}% more bonus fuel`,
        getValue: state => ((state.saved.maxDepth >= FINAL_DEPTH_GOAL) && state.saved.day),
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

// Sets state.achievements and state.saved.achievementStats if necessary.
function initializeAchievements(state) {
    state = {...state, achievements: {}};
    for (let key in achievementsData) state = updateAchievement(state, key);
    return state;
}

function advanceAchievements(state) {
    if (!state.achievements) return initializeAchievements(state);
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
            // This is a null op if lastAchievement is not set or is no longer present.
            state = updateSprite(state, {id: state.lastAchievementId}, {nextAchievementId: achievement.id});
            state = {...state, lastAchievementId: achievement.id};
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
        //console.log({nextAchievementId, nextAchievement});
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
        const target = new Rectangle(iconFrame).scale(2);
        drawImage(context, iconFrame.image, iconFrame,
            target.moveCenterTo(rectangle.left + 15 + target.width / 2, rectangle.top + rectangle.height / 2)
        );
        drawText(context, sprite.label, rectangle.left + 25 + target.width, rectangle.top + rectangle.height / 2,
            sprite.textProperties
        );
    },
    height: 80,
    width: 300,
};

function renderAchievements(context, state) {
    context.fillStyle = '#08F';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const achievementKeys = Object.keys(achievementsData);
    const padding = Math.round(Math.min(canvas.width, canvas.height) / 40);
    const rowHeight = Math.round((canvas.height - 40 - 4 * padding) / achievementKeys.length);
    const size = Math.round(Math.min(rowHeight * 0.5, canvas.width / 25));
    const smallSize = Math.round(size * 0.8);
    let iconScale = 1;
    if (rowHeight >= 30) iconScale += 0.5;
    if (rowHeight >= 36) iconScale += 0.5;
    const middle = Math.round(80 * iconScale);
    let top = padding;
    for (const key of achievementKeys) {
        const data = achievementsData[key];
        const bonusLevel = state.achievements[key];
        context.save();
        for (let i = 0; i < data.bonusValues.length; i++) {
            const iconFrame = ACHIEVEMENT_ICON_FRAMES[i];
            context.globalAlpha = (i <= bonusLevel) ? 1 : 0.5 - 0.1 * i;
            const target = new Rectangle(iconFrame).scale(iconScale);
            drawImage(context, iconFrame.image, iconFrame,
                target.moveCenterTo(middle - (4-i) * (target.width + 2) + target.width / 2, top + rowHeight / 4)
            );
        }
        context.restore();
        let goalValue = (getAchievementStat(state, key) || 0)
        if (bonusLevel + 1 < data.goals.length) {
            goalValue += ' / ' + data.goals[bonusLevel + 1];
        }
        /*if (key === ACHIEVEMENT_EXPLORED_DEEP_IN_X_DAYS && bonusLevel < 0) {
            goalValue = data.goals[bonusLevel + 1];
        }*/
        drawText(context, data.getAchievementLabel(goalValue), middle + 10, top + rowHeight / 4,
            {fillStyle: 'white', textAlign: 'left', textBaseline: 'middle', size}
        );
        if (bonusLevel >= 0) {
            drawText(context, data.getBonusLabel(data.bonusValues[bonusLevel]), middle + 10, top + 3 * rowHeight / 4 - 3,
                {fillStyle: '#F84', textAlign: 'left', textBaseline: 'middle', size: smallSize}
            );
        }
        top += rowHeight;
    }
}

const goldMedalFrame = {
    image: requireImage('gfx/militaryIcons.png'),
    left: 68,
    top: 40,
    width: 16,
    height: 16,
};

module.exports = {
    initializeAchievements,
    advanceAchievements,
    renderAchievements,
    getAchievementBonus,
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
    ACHIEVEMENT_EXPLORED_DEEP_IN_X_DAYS,
    goldMedalFrame,
};

const { crystalFrame, addSprite, deleteSprite, updateSprite } = require('sprites');
const silverMedalFrame = {...goldMedalFrame, left: goldMedalFrame.left + 17};
const bronzeMedalFrame = {...silverMedalFrame, left: silverMedalFrame.left + 17};
const ACHIEVEMENT_ICON_FRAMES = [bronzeMedalFrame, silverMedalFrame, goldMedalFrame, crystalFrame];
