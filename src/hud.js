const { canvas } = require('gameConstants');
const Rectangle = require('Rectangle');
const { drawImage, drawText } = require('draw');

function renderBasicButton(context, state, button) {
    let label = button.label;
    if (button.getLabel) label = button.getLabel(state, button);
    renderButtonBackground(context, state, button);
    const size = button.fontSize || Math.min(
        button.height - 20,
        Math.round(button.width / 5),
    );
    drawText(context, label, button.left + button.width / 2, button.top + button.height / 2,
        {fillStyle: 'white', textAlign: 'center', textBaseline: 'middle', size }
    );
}
function getLayoutProperties(context) {
    return {
        context,
        padding: Math.round(Math.min(canvas.width, canvas.height) / 40),
        width: canvas.width,
        height: canvas.height,
        buttonHeight: Math.round(Math.min(canvas.height / 8, canvas.width / 6 / 2.5)),
        buttonWidth: Math.round(Math.min(2.5 * canvas.height / 8, canvas.width / 6)),
    };
}

const sleepButton = {
    label: 'Sleep',
    render: renderBasicButton,
    onClick(state) {
        return nextDay(state);
    },
    resize({padding, width, buttonWidth, buttonHeight}) {
        this.height = buttonHeight;
        this.width = buttonWidth;
        this.top = padding;
        this.left = width - padding - this.width;
    },
};

class DiffuserButton {
    constructor() {
        this.left = 20;
        this.top = canvas.height - 70;
        this.width = 120;
        this.height = 60;
    }
    render(context, state) {
        renderButtonBackground(context, state, this);
        drawText(context, state.bombDiffusers, this.left + this.width - 15, this.top + this.height / 2,
            {fillStyle: '#A40', strokeStyle: '#FA4', size: 36, textBaseline: 'middle', textAlign: 'right'});
        const iconRectangle = new Rectangle(diffuserFrame).scale(2);
        drawImage(context, diffuserFrame.image, diffuserFrame,
            iconRectangle.moveCenterTo(this.left + 15 + iconRectangle.width / 2, this.top + this.height / 2)
        );
    }
    isActive(state) {
        return state.usingBombDiffuser;
    }
    onClick(state) {
        return {...state, usingBombDiffuser: !state.usingBombDiffuser};
    }
    resize({padding, height, buttonWidth, buttonHeight}) {
        this.height = buttonHeight;
        this.width = buttonWidth;
        this.top = height - padding - this.height;
        this.left = padding;
    }
}
const diffuserButton = new DiffuserButton();
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
    resize(layoutProperties) {
        const {padding, buttonHeight} = layoutProperties;
        this.width = this.height = buttonHeight;
        sleepButton.resize(layoutProperties);
        this.top = padding;
        this.left = sleepButton.left - padding - this.width;
    },
};

const digButton = {
    ...sleepButton,
    label: 'Dig',
    onClick(state) {
        return {...state, shop: false, fuel: state.saved.maxFuel, startingDepth: 1};
    },
    row: 0,
    resize({padding, width, buttonWidth, buttonHeight}) {
        this.height = buttonHeight;
        this.width = buttonWidth;
        this.top = padding + this.row * (buttonHeight+padding) + (this.row ? padding : 0);
        this.left = width - padding - this.width;
    },
};
const digButtonSpacing = digButton.height + 10;
const depthOffset = digButton.top + 10;
const depth20Button = {
    ...digButton,
    label: 'Dig 20',
    onClick(state) {
        return {...state, shop: false, fuel: state.saved.maxFuel, startingDepth: 20};
    },
    top: depthOffset + digButtonSpacing,
    row: 1,
};
const depth50Button = {
    ...digButton,
    label: 'Dig 50',
    onClick(state) {
        return {...state, shop: false, fuel: state.saved.maxFuel, startingDepth: 50};
    },
    row: 2,
};
const depth100Button = {
    ...digButton,
    label: 'Dig 100',
    onClick(state) {
        return {...state, shop: false, fuel: state.saved.maxFuel, startingDepth: 100};
    },
    row: 3,
};
const depth150Button = {
    ...digButton,
    label: 'Dig 150',
    onClick(state) {
        return {...state, shop: false, fuel: state.saved.maxFuel, startingDepth: 150};
    },
    row: 4,
};

const closeButton =  {
    ...sleepButton,
    label: 'Close',
    onClick(state) {
        return {...state, showAchievements: false};
    },
    resize({padding, width, height, buttonWidth, buttonHeight}) {
        this.height = buttonHeight;
        this.width = buttonWidth;
        this.top = height - this.height - padding;
        this.left = Math.round((width - this.width) / 2);
    },
};
const restartButton = {
    ...sleepButton,
    label: 'Restart from Day 1',
    onClick(state) {
        return restart(state);
    },
    resize({context, padding, height, width, buttonHeight}) {
        this.height = buttonHeight;
        this.fontSize = Math.min(
            this.height - 20,
            Math.round(width / 32),
        );
        const textWidth = drawText(context, this.label, 0, -10,
            {fillStyle: 'white', textAlign: 'bottom', size: this.fontSize, measure: true}
        );
        this.width = textWidth + 20;
        this.top = height - this.height - padding;
        this.left = padding;
    },
};

function renderButtonBackground(context, state, button) {
    const enabled = !button.isEnabled || button.isEnabled(state, button);
    const active = button.isActive && button.isActive(state, button);
    context.fillStyle = (state.overButton === button || active) ? (enabled ? '#0A4' : '#A00') : '#00A';
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

        const {left, top, width, height} = new Rectangle(button).pad(-5);

        const rowHeight = Math.round(height / 3);
        const halfHeight = Math.round(height / 6);
        const size = Math.min(
            Math.round(rowHeight * .5 / 2) * 2,
            Math.round(width / 26) * 2,
        );
        const middle = Math.round(width / 2);
        const textBaseline = 'middle';
        context.save();
        context.translate(left, top);

        context.beginPath();
        context.moveTo(10, rowHeight);
        context.lineTo(width - 10, rowHeight);
        context.stroke();

        // console.log(left, top, width / 2, halfHeight)
        drawText(context, button.getLabel(state, button), middle, halfHeight,
            {fillStyle: 'white', textAlign: 'center', textBaseline, size}
        );

        let x = middle;
        let y = rowHeight + halfHeight;
        context.beginPath();
        context.moveTo(x - 10, y);
        context.lineTo(x + 10, y);
        context.lineTo(x + 5, y - 5);
        context.moveTo(x + 10, y);
        context.lineTo(x + 5, y + 5);
        context.stroke();

        drawText(context, button.getCurrentValue(state, button), x - 15, y,
            {fillStyle: 'white', textAlign: 'right', textBaseline, size}
        );

        drawText(context, button.getNextValue(state, button), x + 15, y,
            {fillStyle: '#0F0', textAlign: 'left', textBaseline, size}
        );

        x = width - 20;
        y = 2 * rowHeight + halfHeight;
        const cost = button.getCost(state, button);
        const fillStyle = (cost <= state.saved.score) ? '#4AF' : '#F00';
        canvas.style.letterSpacing = '2px';
        const costWidth = drawText(context, cost, x, y,
            {fillStyle, strokeStyle: 'white', textAlign: 'right', textBaseline, size, measure: true}
        );
        canvas.style.letterSpacing = '';
        let scale = 1;
        if (crystalFrame.height < 0.75 * size) scale = 2;
        const iconRectangle = new Rectangle(crystalFrame).scale(scale);
        x = x - costWidth - 5 - iconRectangle.width / 2;
        drawImage(context, crystalFrame.image, crystalFrame, iconRectangle.moveCenterTo(x, y));
        context.restore();
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
    resize({padding, height, width, buttonWidth, buttonHeight}) {
        if (height * 1.2 >= width) {
            this.height = Math.round((height - 10 * padding) / 4);
            this.width = width - buttonWidth - 6 * padding;
            this.top = this.row ? 2 * padding + this.height : padding;
            if (this.column) this.top += 2 * (padding + this.height);
            this.left = padding;
        } else {
            const smallHeight = Math.round((5 * buttonHeight + 4 * padding) / 2);
            const largeHeight = Math.round((height - 10 * padding) / 2);
            if (largeHeight >= smallHeight + 20) this.height = largeHeight;
            else this.height = smallHeight;
            this.width = Math.round((width - buttonWidth - 6 * padding) / 2);
            this.top = this.row ? 2 * padding + this.height : padding;
            this.left = this.column ? 2 * padding + this.width : padding;
        }
    },
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
    row: 0, column: 0,
};
const rangeButton = {
    ...fuelButton,
    getCost(state) {
        return Math.round(100 * Math.pow(2, 2 * (state.saved.range - 0.2) - 1));
    },
    getLabel() {
        return `Range`;
    },
    getCurrentValue(state) {
        let A = getDepthOfRange(state, 2.5, 0);
        let B = getDepthOfRange(state, 1.5, 0);
        if (A>=0) return '++'+A+':+'+B;
        return '+'+B;
    },
    getNextValue(state) {
        let A = getDepthOfRange(state, 2.5, 0.5);
        let B = getDepthOfRange(state, 1.5, 0.5);
        if (A>=0) return '++'+A+':+'+B;
        return '+'+B;
    },
    onPurchase(state) {
        return {...state, saved: {...state.saved, range: state.saved.range + 0.5}};
    },
    row: 0, column: 1,
};
const bombDiffuserButton = {
    ...fuelButton,
    getCost(state) {
        return Math.round(25 * Math.pow(2, state.saved.bombDiffusers));
    },
    getLabel(){
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
    row: 1, column: 0,
};
const explosionProtectionButton = {
    ...fuelButton,
    getCost(state) {
        return Math.round(100 * Math.pow(2, 5 * state.saved.explosionProtection));
    },
    getLabel(){
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
    row: 1, column: 1,
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
        const maxStartingDepth = Math.min(
            Math.floor(state.saved.lavaDepth - 1),
            getAchievementBonus(state, ACHIEVEMENT_EXPLORE_DEPTH_X),
        );
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
        if (maxStartingDepth >= 150) buttons.push(depth150Button);
        return buttons;
    }
    return [
        sleepButton,
        diffuserButton,
        achievementButton,
    ];
}

function renderHUD(context, state) {
    // Draw SCORE indicator
    const scoreWidth = drawText(context, state.saved.score, canvas.width - 10, canvas.height - 10,
        {fillStyle: '#4AF', strokeStyle: 'white', textAlign: 'right', textBaseline: 'bottom', size: 36, measure: true}
    );
    let iconRectangle = new Rectangle(crystalFrame).scale(2);
    drawImage(context, crystalFrame.image, crystalFrame,
        iconRectangle.moveCenterTo(
            canvas.width - 20 - scoreWidth - 5 - iconRectangle.width / 2,
            canvas.height - 10 - 20
        )
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
        drawText(context, 'FUEL ' + state.fuel, 15, 12, {fillStyle: 'white', size: 19, textBaseline: 'top'});
        context.strokeStyle = 'white';
        context.lineWidth = 2;
        context.strokeRect(10, 10, fuelBarWidth, 20);

        // Render DAY #
        drawText(context, `DAY ${state.saved.day}`, 20 + fuelBarWidth, 10, {fillStyle: 'white', size: 20, textBaseline: 'top'});
    }

    // Render buttons
    const layoutProperties = getLayoutProperties(context);
    for (const button of getHUDButtons(state)) {
        if (state.lastResized !== button.lastResized) {
            if (button.resize) button.resize(layoutProperties);
            else console.log('no resize function:', button);
            button.lastResized = state.lastResized;
        }
        button.render(context, state, button);
    }

}

module.exports = {
    renderHUD,
    getHUDButtons,
};

const { nextDay, restart } = require('state');
const {
    canExploreCell, getFuelCost, getFlagValue,
    getDepthOfRange,
    getExplosionProtectionAtDepth,
} = require('digging');
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

