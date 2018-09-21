const {
    WIDTH,
    HEIGHT,
} = require('gameConstants');
const Rectangle = require('Rectangle');
const { drawImage, drawText } = require('draw');

function renderBasicButton(context, state, button) {
    let label = button.label;
    if (button.getLabel) label = button.getLabel(state, button);
    renderButtonBackground(context, state, button);
    drawText(context, label, button.left + button.width / 2, button.top + button.height / 2,
        {fillStyle: 'white', textAlign: 'center', textBaseline: 'middle', size: button.height - 30}
    );
}

const sleepButton = {
    label: 'Sleep',
    render: renderBasicButton,
    onClick(state) {
        return nextDay(state);
    },
    left: WIDTH - 130,
    top: 10,
    width: 120,
    height: 60,
};
const achievementButton = {
    render(context, state, button) {
        context.save();
        context.globalAlpha = state.overButton === button ? 1 : 0.6;
        drawImage(context, goldMedalFrame.image, goldMedalFrame, new Rectangle(button).pad(-1));
        context.restore();
    },
    onClick(state) {
        return {...state, showAchievements: state.time};
    },
    left: sleepButton.left - 60,
    top: sleepButton.top + sleepButton.height / 2 - 25,
    width: 50,
    height: 50,
};

const digButton = {
    ...sleepButton,
    label: 'Dig',
    onClick(state) {
        return {...state, shop: false, fuel: state.saved.maxFuel, startingDepth: 1};
    },
    left: 650,
    width: 130,
    top: 20,
};
const depthOffset = digButton.top + 60;
const depth20Button = {
    ...digButton,
    label: 'Dig 20',
    onClick(state) {
        return {...state, shop: false, fuel: state.saved.maxFuel, startingDepth: 20};
    },
    top: depthOffset + (digButton.height + 20)
};
const depth50Button = {
    ...digButton,
    label: 'Dig 50',
    onClick(state) {
        return {...state, shop: false, fuel: state.saved.maxFuel, startingDepth: 50};
    },
    top: depthOffset + (digButton.height + 20) * 2
};
const depth100Button = {
    ...digButton,
    label: 'Dig 100',
    onClick(state) {
        return {...state, shop: false, fuel: state.saved.maxFuel, startingDepth: 100};
    },
    top: depthOffset + (digButton.height + 20) * 3
};
const depth200Button = {
    ...digButton,
    label: 'Dig 200',
    onClick(state) {
        return {...state, shop: false, fuel: state.saved.maxFuel, startingDepth: 200};
    },
    top: depthOffset + (digButton.height + 20) * 4
};

const closeButton = {
    ...digButton,
    label: 'Close',
    onClick(state) {
        return {...state, showAchievements: false};
    },
    left: WIDTH / 2 - digButton.width / 2,
    top: HEIGHT - 80,
};
const restartButton = {
    ...closeButton,
    label: 'Restart from Day 1',
    onClick(state) {
        return restart(state);
    },
    left: 20,
    width: 300,
}

function renderButtonBackground(context, state, button) {
    const enabled = !button.isEnabled || button.isEnabled(state, button);
    context.fillStyle = state.overButton === button ? (enabled ? '#0A4' : '#A00') : '#00A';
    context.fillRect(button.left, button.top, button.width, button.height);

    context.strokeStyle = 'black';
    context.lineWidth = 4;
    context.strokeRect(button.left + 1, button.top + 1, button.width - 2, button.height - 2);

    context.strokeStyle = 'white';
    context.lineWidth = 2;
    context.strokeRect(button.left, button.top, button.width, button.height);

    context.strokeStyle = 'white';
    context.lineWidth = 2;
    context.strokeRect(button.left + 5, button.top + 5, button.width - 10, button.height - 10);
}

const shopButton = {
    render(context, state, button) {
        renderButtonBackground(context, state, button);

        context.beginPath();
        context.moveTo(button.left + 20, button.top + 70);
        context.lineTo(button.left + button.width - 20, button.top + 70);
        context.stroke();

        drawText(context, button.getLabel(state, button), button.left + button.width / 2, button.top + 10 + 30,
            {fillStyle: 'white', textAlign: 'center', textBaseline: 'middle', size: 30}
        );

        const x = button.left + button.width / 2;
        const y = button.top + 10 + 90;

        context.beginPath();
        context.moveTo(x - 10, y);
        context.lineTo(x + 10, y);
        context.lineTo(x + 5, y - 5);
        context.moveTo(x + 10, y);
        context.lineTo(x + 5, y + 5);
        context.stroke();

        drawText(context, button.getCurrentValue(state, button), button.left + button.width / 2 - 15, button.top + 10 + 90,
            {fillStyle: 'white', textAlign: 'right', textBaseline: 'middle', size: 30}
        );

        drawText(context, button.getNextValue(state, button), button.left + button.width / 2 + 15, button.top + 10 + 90,
            {fillStyle: '#0F0', textAlign: 'left', textBaseline: 'middle', size: 30}
        );

        const cost = button.getCost(state, button);
        const fillStyle = (cost <= state.saved.score) ? '#4AF' : '#F00';
        const costWidth = drawText(context, cost, button.left + button.width - 20, button.top + 10 + 150,
            {fillStyle, strokeStyle: 'white', textAlign: 'right', textBaseline: 'middle', size: 36, measure: true}
        );
        const iconRectangle = new Rectangle(crystalFrame).scale(2);
        drawImage(context, crystalFrame.image, crystalFrame,
            iconRectangle.moveCenterTo(button.left + button.width - 20 - costWidth - 5 - iconRectangle.width / 2, button.top + 10 + 150)
        );
    },
    isEnabled(state, button) {
        return state.saved.score >= button.getCost(state, button);
    },
    onClick(state, button) {
        if (this.isEnabled(state, button)) {
            state = {...state, saved: {...state.saved, score: state.saved.score - button.getCost(state, button)}};
            return button.onPurchase(state, button);
        }
        return state;
    },
    width: 300,
    height: 200, // 3 60px lines 10px border
};

const fuelButton = {
    ...shopButton,
    getCost(state) {
        return Math.round(state.saved.maxFuel * Math.log10(state.saved.maxFuel) * Math.log10(state.saved.maxFuel) / 4);
    },
    getLabel(){
        return 'Max Fuel';
    },
    getCurrentValue(state) {
        return state.saved.maxFuel;
    },
    getNextValue(state) {
        return Math.round(state.saved.maxFuel * 1.2 + 50);
    },
    onPurchase(state, button) {
        return {...state, saved: {...state.saved, maxFuel: this.getNextValue(state, button)}};
    },
    left: 20,
    top: 20,
};
const rangeButton = {
    ...fuelButton,
    getCost(state) {
        return Math.round(100 * Math.pow(2, 2 * (state.saved.range - 0.2) - 1));
    },
    getLabel(state){
        return `Range At Depth ${state.saved.maxDepth}`;
    },
    getCurrentValue(state) {
        return getRangeAtDepth(state, state.saved.maxDepth, 0).toFixed(2);
    },
    getNextValue(state) {
        return getRangeAtDepth(state, state.saved.maxDepth, 0.5).toFixed(2);
    },
    onPurchase(state) {
        return {...state, saved: {...state.saved, range: state.saved.range + 0.5}};
    },
    left: 330,
    top: 20,
};
const bombDiffuserButton = {
    ...fuelButton,
    getCost(state) {
        return Math.round(25 * Math.pow(2, state.saved.bombDiffusers));
    },
    getLabel(state){
        return 'Bomb Diffusers';
    },
    getCurrentValue(state) {
        const bonuses = getAchievementBonus(state, ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY);
        return state.saved.bombDiffusers + (bonuses ? `(+${bonuses})` : '');
    },
    getNextValue(state) {
        const bonuses = getAchievementBonus(state, ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY);
        return state.saved.bombDiffusers + 1 + (bonuses ? `(+${bonuses})` : '');
    },
    onPurchase(state) {
        return {...state,
            // Update current number of bomb diffusers since they have already been refilled.
            bombDiffusers: state.bombDiffusers + 1,
            saved: {...state.saved, bombDiffusers: state.saved.bombDiffusers + 1}
        };
    },
    left: 20,
    top: 260,
};
const explosionProtectionButton = {
    ...fuelButton,
    getCost(state) {
        return Math.round(100 * Math.pow(2, 5 * state.saved.explosionProtection));
    },
    getLabel(state){
        return 'Explosion Protection';
    },
    getCurrentValue(state) {
        return (getExplosionProtectionAtDepth(state, state.saved.maxDepth) * 100).toFixed(0) +'%';
    },
    getNextValue(state) {
        return (getExplosionProtectionAtDepth(state, state.saved.maxDepth, 0.2) * 100).toFixed(0) +'%';
    },
    onPurchase(state) {
        return {...state, saved: {...state.saved, explosionProtection: state.saved.explosionProtection + 0.2}};
    },
    left: 330,
    top: 260,
};

const scrollDownButton = {
    render(context, state, button) {
        context.save();
        context.globalAlpha = state.overButton === button ? 1 : 0.5;
        context.fillStyle = 'white';
        context.fillRect(button.left, button.top, button.width, button.height);
        context.fillStyle = 'black';
        context.beginPath();
        const x = button.left + button.width / 2;
        const y = button.top + button.height / 2;
        const r = Math.min(button.height, button.width) / 3;
        context.moveTo(x + r * Math.cos(button.angle), y + r * Math.sin(button.angle));
        context.lineTo(x + r * Math.cos(button.angle + 2 * Math.PI / 3), y + r * Math.sin(button.angle + 2 * Math.PI / 3));
        context.lineTo(x + r * Math.cos(button.angle + 4 * Math.PI / 3), y + r * Math.sin(button.angle + 4 * Math.PI / 3));
        context.fill();
        context.restore();
    },
    advance(state, button) {
        if (state.overButton === button) {
            state = button.scroll(state, button);
            state = {...state, selected: null};
        }
        return state;
    },
    scroll(state) {
        const camera = {...state.camera};
        camera.top += 10;
        return {...state, camera};
    },
    angle: Math.PI / 2,
    left: WIDTH / 2 - 40,
    top: HEIGHT - 40,
    width: 80,
    height: 40,
};
const scrollUpButton = {
    ...scrollDownButton,
    angle: 3 * Math.PI / 2,
    scroll(state) {
        const camera = {...state.camera};
        camera.top = Math.max(-100, camera.top - 10);
        return {...state, camera};
    },
    top: 0,
};
const scrollLeftButton = {
    ...scrollDownButton,
    angle: Math.PI,
    scroll(state) {
        const camera = {...state.camera};
        camera.left -= 10;
        return {...state, camera};
    },
    width: 40,
    height: 80,
    top: HEIGHT / 2 - 40,
    left: 0
};
const scrollRightButton = {
    ...scrollLeftButton,
    angle: 0,
    scroll(state) {
        const camera = {...state.camera};
        camera.left += 10;
        return {...state, camera};
    },
    left: WIDTH - 40,
};


function getHUDButtons(state) {
    if (state.showAchievements) {
        const buttons = [closeButton];
        if (getAchievementStat(state, ACHIEVEMENT_EXPLORE_DEPTH_X) >= 200) {
            buttons.push(restartButton);
        }
        return buttons;
    }
    if (state.shop) {
        const maxStartingDepth = getAchievementBonus(state, ACHIEVEMENT_EXPLORE_DEPTH_X);
        const buttons = [
            digButton,
            fuelButton,
            rangeButton,
            bombDiffuserButton,
            explosionProtectionButton,
        ];
        if (maxStartingDepth >= 20) buttons.push(depth20Button);
        if (maxStartingDepth >= 50) buttons.push(depth50Button);
        if (maxStartingDepth >= 100) buttons.push(depth100Button);
        if (maxStartingDepth >= 200) buttons.push(depth200Button);
        return buttons;
    }
    return [
        sleepButton,
        achievementButton,
        scrollUpButton,
        scrollDownButton,
        scrollLeftButton,
        scrollRightButton,
    ];
}

function renderHUD(context, state) {
    // Draw DEPTH indicator
    if (!state.shop && state.overButton && state.overButton.cell) {
        context.textAlign = 'left';
        context.textBaseline = 'bottom';
        context.font = `36px sans-serif`;
        context.fillStyle = 'black';
        context.lineWidth = 1;
        context.strokeStyle = 'white';
        const depth = getDepth(state, state.overButton.row, state.overButton.column);
        context.fillText(`DEPTH: ${depth}`, 10, HEIGHT - 10);
        context.strokeText(`DEPTH: ${depth}`, 10, HEIGHT - 10);
    }
    // Draw SCORE indicator
    const scoreWidth = drawText(context, state.saved.score,WIDTH - 20, HEIGHT - 20,
        {fillStyle: '#4AF', strokeStyle: 'white', textAlign: 'right', textBaseline: 'bottom', size: 36, measure: true}
    );
    let iconRectangle = new Rectangle(crystalFrame).scale(2);
    drawImage(context, crystalFrame.image, crystalFrame,
        iconRectangle.moveCenterTo(WIDTH - 20 - scoreWidth - 5 - iconRectangle.width / 2, HEIGHT - 20 - 20)
    );
    const diffuserWidth = drawText(context, state.bombDiffusers, WIDTH - 20, HEIGHT - 65,
        {fillStyle: '#A40', strokeStyle: '#FA4', size: 36, textBaseline: 'bottom', textAlign: 'right', measure: true});
    iconRectangle = new Rectangle(diffuserFrame).scale(2);
    drawImage(context, diffuserFrame.image, diffuserFrame,
        iconRectangle.moveCenterTo(WIDTH - 20 - diffuserWidth - 10 - iconRectangle.width / 2, HEIGHT - 65 - 20)
    );

    // Draw FUEL indicator
    if (!state.shop && !state.showAchievements) {
        const fuelMultiplier = 1 + getAchievementBonus(state, ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY) / 100;
        const fuelBarWidth = 200 * fuelMultiplier;
        const maxFuel = Math.round(state.saved.maxFuel * fuelMultiplier);
        context.fillStyle = 'black';
        context.fillRect(10, 10, fuelBarWidth, 20);
        context.fillStyle = '#080';
        const fuelWidth = Math.round(fuelBarWidth * state.fuel / maxFuel);
        const displayFuelWidth = Math.round(fuelBarWidth * state.displayFuel / maxFuel);
        context.fillRect(10, 10, fuelWidth, 20);
        if (state.displayFuel > state.fuel) {
            const difference = displayFuelWidth - fuelWidth;
            context.fillStyle = '#F00';
            context.fillRect(10 + fuelWidth, 10, difference, 20);
        } else if (state.displayFuel < state.fuel) {
            const difference = fuelWidth - displayFuelWidth;
            context.fillStyle = '#0F0';
            context.fillRect(10 + fuelWidth - difference, 10, difference, 20);
        }
        if (state.overButton && state.overButton.cell) {
            const {row, column} = state.overButton;
            if (canExploreCell(state, row, column) && getFlagValue(state, row, column) !== 2) {
                const fuelCost = getFuelCost(state, row, column);
                const fuelLeft = 10 + Math.round(fuelBarWidth * Math.max(0, state.fuel - fuelCost) / maxFuel);
                context.fillStyle = (fuelCost <= state.fuel) ? 'orange' : 'red';
                context.fillRect(fuelLeft, 10, 10 + fuelWidth - fuelLeft, 20);
                if (fuelCost <= state.fuel) {
                    const bonusFuelMultiplier = 1 + getAchievementBonus(state, ACHIEVEMENT_EXPLORED_DEEP_IN_X_DAYS) / 100;
                    const fuelBonus = Math.min(maxFuel, state.fuel + Math.round(bonusFuelMultiplier * fuelCost * 0.1));
                    context.fillStyle = '#0F0';
                    context.fillRect(10 + fuelWidth, 10, Math.round(fuelBarWidth * fuelBonus / maxFuel) - fuelWidth, 20);
                }
            }
        }
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.font = `19px sans-serif`;
        context.fillStyle = 'white';
        context.fillText('FUEL ' + state.fuel, 15, 9);
        context.strokeStyle = 'white';
        context.lineWidth = 2;
        context.strokeRect(10, 10, fuelBarWidth, 20);
    }

    // Render buttons
    for (const button of getHUDButtons(state)) {
        button.render(context, state, button);
    }

    if (!state.shop && !state.showAchievements) {
        const dayTextWidth = drawText(context, `DAY ${state.saved.day}`, 23, 35, {fillStyle: 'white', size: 20, textBaseline: 'top', measure: true});
    }
}

module.exports = {
    renderHUD,
    getHUDButtons,
};

const { nextDay, restart } = require('state');
const { canExploreCell, getFuelCost, getFlagValue, getDepth, getRangeAtDepth, getExplosionProtectionAtDepth } = require('digging');
const { crystalFrame, diffuserFrame } = require('sprites');
const {
    goldMedalFrame,
    getAchievementBonus,
    getAchievementStat,
    ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY,
    ACHIEVEMENT_EXPLORED_DEEP_IN_X_DAYS,
    ACHIEVEMENT_EXPLORE_DEPTH_X,
    ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY,
} = require('achievements');

