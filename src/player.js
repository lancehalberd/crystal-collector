

function getMaxFuel(state) {
    return state.saved.maxFuel * getMaxFuelMultiplier(state);
}

const FINAL_DEPTH_GOAL = 200;

const ACHIEVEMENT_EXPLORE_DEPTH_X = 'exploreDepthX';
const ACHIEVEMENT_EXPLORED_DEEP_IN_X_DAYS = 'exploredDeepInXDays';
const ACHIEVEMENT_COLLECT_X_CRYSTALS = 'collectXCrystals';
const ACHIEVEMENT_COLLECT_X_CRYSTASL_IN_ONE_DAY = 'collectXCrystalsInOneDay';
const ACHIEVEMENT_DIFFUSE_X_BOMBS = 'diffuseXBombs';
const ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY = 'diffuseXBombsInOneDay';
const ACHIEVEMENT_PREVENT_X_EXPLOSIONS = 'preventXExplosions';
const ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY ='gainXBonusFuelInOneDay';
const achievementsData = {
    [ACHIEVEMENT_EXPLORE_DEPTH_X]: {
        goals: [20, 50, 100, 200],
        bonusValues: [20, 50, 100, 200],
        getAchievementLabel: goal => `Explore depth ${goal}`,
        getBonusLabel: bonusValue => `Start from depth ${bonusValue}`,
        getValue: state => state.saved.maxDepth,
        valueIsBetter: (value, goal) => value > goal,
    },
    [ACHIEVEMENT_EXPLORED_DEEP_IN_X_DAYS]: {
        goals: [100, 80, 60, 40],
        bonusValues: [50, 100, 150, 200],
        getAchievementLabel: goal => `Explore depth ${FINAL_DEPTH_GOAL} by day ${goal}`,
        getBonusLabel: bonusValue => `Gain ${bonusValue}% more bonus fuel`,
        getValue: state => (state.saved.maxDepth >= FINAL_DEPTH_GOAL) && state.saved.days,
        valueIsBetter: (value, goal) => value < goal,
    },
    [ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY]: {
        goals: [50, 500, 5000, 50000],
        bonusValues: [25, 50, 75, 100],
        getAchievementLabel: goal => `Gain ${goal} bonus fuel in one day`,
        getBonusLabel: bonusValue => `${bonusValue}% more fuel capacity`,
        getValue: state => state.bonusFuelGainedToday,
        valueIsBetter: (value, goal) => value > goal,
    },
};
// Sets state.achievements and state.saved.achievementStats if necessary.
function initializeAchievements(state) {
    const achievements = {};
    for (let key in achievementsData) {
        const data = achievementsData[key];
        state = updateAchievement(state, key)
        const value = getAchievementStat(state, key);
        let bonusLevel = -1, goal = data.goals[bonusLevel + 1];
        while (value && (value === goal || data.valueIsBetter(value, goal))) {
            bonusLevel++;
            goal = data.goals[bonusLevel + 1];
        }
        achievements[key] = bonusLevel;
    }
    return {...state, achievements};
}
function advanceAchievements(state) {
    if (!state.achievements) {
        state = initializeAchievements(state);
    }
    const achievements = {...state.achievements},
    return state;
}

function updateAchievement(state, key) {
    const savedValue = getAchievementStat(state, key);
    const currentValue = achievementsData[key].getValue(state);
    if (currentValue && (!savedValue || achievementsData[key].valueIsBetter(currentValue, savedValue))) {
        state = setAchievementStat(state, key, currentValue);
    }
    return state;
}
function setAchievementStat(state, key, value) {
    const achievementStats = {...state.saved.achievementStats, [key]: value};
    return {...state, saved: {...state.saved, achievementStats}};
}
function getAchievementStat(state, key) {
    const achievementStats = state.saved.achievementStats || {};
    return achievementStats[key] || false;
}

function getMaxFuelMultiplier(state) {
}