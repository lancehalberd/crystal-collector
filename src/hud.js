const { canvas, COLOR_GOOD, COLOR_BAD } = require('gameConstants');
const Rectangle = require('Rectangle');
const { drawImage, drawText } = require('draw');
const { createAnimation, getFrame, requireImage, r } = require('animations');

module.exports = {
    renderHUD,
    getHUDButtons,
    getLayoutProperties,
};

const { restart, updateSave, resumeDigging, } = require('state');
const {
    canExploreCell, getFuelCost, getFlagValue,
    getDepthOfRange,
    getDepthOfExplosionProtection,
    getMaxExplosionProtection,
    teleportOut,
} = require('digging');
const { crystalFrame, diffuserFrame } = require('sprites');
const {
    achievementAnimation,
    getAchievementBonus,
    getAchievementStat,
    ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY,
    ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS,
    ACHIEVEMENT_EXPLORE_DEPTH_X,
    ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY,
} = require('achievements');

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
function getLayoutProperties(context, state) {
    const padding = Math.round(Math.min(canvas.width, canvas.height) / 40);
    const buttonHeight = Math.round(Math.min(canvas.height / 8, canvas.width / 6 / 2.5));
    const buttonWidth = Math.round(Math.min(2.5 * canvas.height / 8, canvas.width / 6));
    const landscapeShopSize = Math.min(canvas.width - 3 * padding - buttonWidth, canvas.height - 2 * padding - buttonHeight);
    const portraitShopSize = Math.min(canvas.width - 2 * padding, canvas.height - 6 * padding - 3 * buttonHeight);
    const portraitMode = portraitShopSize > landscapeShopSize;
    const shopSize = Math.max(landscapeShopSize, portraitShopSize);
    const shopLeft = portraitMode ? Math.round((canvas.width - shopSize) / 2)
        : Math.round((canvas.width - padding - buttonWidth - shopSize) / 2);
    const shopTop = portraitMode ? Math.round((canvas.height - 5 * padding - 3 * buttonHeight - shopSize) / 2)
        : Math.round((canvas.height - padding - buttonHeight - shopSize) / 2);
    return {
        portraitMode,
        shopRectangle: new Rectangle(shopLeft, shopTop, shopSize, shopSize),
        context,
        animationTime: state.time - state.shop,
        padding,
        width: canvas.width,
        height: canvas.height,
        buttonHeight,
        buttonWidth,
    };
}

const sleepButtonAnimation = createAnimation('gfx/sleep.png', r(80, 30), {cols: 2, duration: 20});
const sleepButtonActiveAnimation = createAnimation('gfx/sleep.png', r(80, 30), {x: 2, duration: 20});
const sleepButton = {
    label: 'Sleep',
    render(context, state, button) {
        const active = button.isActive && button.isActive(state, button);
        let frame = sleepButtonAnimation.frames[0];
        if (active) {
            frame = getFrame(sleepButtonActiveAnimation, state.time);
        } else if (state.saved.fuel < state.saved.maxFuel / 10) {
            // This makes the button flash when they are below 10% fuel.
            frame = getFrame(sleepButtonAnimation, state.time);
        }
        drawImage(context, frame.image, frame, button);
    },
    onClick(state) {
        return teleportOut(state);
    },
    resize({padding, width}) {
        this.height = sleepButtonAnimation.frames[0].height;
        this.width = sleepButtonAnimation.frames[0].width;
        this.scale = Math.min(2, Math.max(1, Math.floor(2 * width / 4 / this.width) / 2));
        this.height *= this.scale;
        this.width *= this.scale;
        this.top = padding;
        this.left = width - padding - this.width;
    },
};
const achievementButton = {
    render(context, state, button) {
        context.save();
        const animationTime = state.time - (state.lastAchievementTime || state.time);
        context.globalAlpha = (animationTime && animationTime < achievementAnimation.duration) ? 1 : 0.8;
        const frame = getFrame(achievementAnimation, animationTime);
        drawImage(context, frame.image, frame, new Rectangle(button).pad(-1));
        context.restore();
    },
    onClick(state) {
        return {...state, showAchievements: state.time};
    },
    resize(layoutProperties) {
        sleepButton.resize(layoutProperties);
        const {padding} = layoutProperties;
        this.width = this.height = sleepButton.scale * achievementAnimation.frames[0].width;
        this.top = padding + (sleepButton.height - this.height) / 2;
        this.left = sleepButton.left - padding - this.width;
    },
};

const upgradeButton = {
    label: 'Upgrade',
    render: renderBasicButton,
    onClick(state) {
        return {...state, ship: false, shop: state.time};
    },
    resize({padding, height, buttonWidth, buttonHeight}) {
        this.height = buttonHeight;
        this.width = Math.round(buttonWidth * 1.5);
        this.top = height - padding - this.height;
        this.left = padding;
    },
};
const shipButton = {
    ...upgradeButton,
    label: 'Warp Drive',
    render: renderBasicButton,
    onClick(state) {
        // Set collectingPart to false so we don't show the part teleport in again if the
        // user switched to the shop and back.
        return {...state, ship: true, shop: state.time, collectingPart: false};
    },
};

class DiffuserButton {
    render(context, state) {
        renderButtonBackground(context, state, this);
        drawText(context, state.saved.bombDiffusers, this.left + this.width - 15, this.top + this.height / 2,
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
        this.height = Math.round(buttonHeight * 1.2);
        this.width = Math.round(buttonWidth * 1.2);
        this.top = height - padding - this.height;
        this.left = padding;
    }
}
const diffuserButton = new DiffuserButton();

const digButton = {
    render: renderBasicButton,
    label: 'Dig',
    onClick(state) {
        return resumeDigging({...state, startingDepth: 1});
    },
    resize({padding, portraitMode, width, height, buttonWidth, buttonHeight}) {
        this.height = buttonHeight;
        this.width = buttonWidth;
        if (portraitMode) {
            this.top = height - 2 * padding - Math.round(2.5 * buttonHeight);
            this.left = padding;
        } else {
            this.top = padding;
            this.left = width - padding - this.width;
        }
    },
};
const digButtonSpacing = digButton.height + 10;
const depthOffset = digButton.top + 10;
function resizeDigButton({padding, portraitMode, width, height, buttonWidth, buttonHeight}) {
    this.height = buttonHeight;
    this.width = buttonWidth;
    if (portraitMode) {
        const column = this.row % 2;
        const row = (this.row - column) / 2;
        this.top = height - (3 - row) * (buttonHeight + padding);
        this.left = padding * 4 + (1 + column) * (buttonWidth + padding);
    } else {
        this.top = padding * 2 + (1 + this.row) * (buttonHeight + padding);
        this.left = width - padding - this.width;
    }
}
const depth20Button = {
    ...digButton,
    label: 'Dig 20',
    onClick(state) {
        return resumeDigging({...state, startingDepth: 20});
    },
    resize: resizeDigButton,
    top: depthOffset + digButtonSpacing,
    row: 0,
};
const depth50Button = {
    ...digButton,
    label: 'Dig 50',
    onClick(state) {
        return resumeDigging({...state, startingDepth: 50});
    },
    resize: resizeDigButton,
    row: 1,
};
const depth100Button = {
    ...digButton,
    label: 'Dig 100',
    onClick(state) {
        return resumeDigging({...state, startingDepth: 100});
    },
    resize: resizeDigButton,
    row: 2,
};
const depth150Button = {
    ...digButton,
    label: 'Dig 150',
    onClick(state) {
        return resumeDigging({...state, startingDepth: 150});
    },
    resize: resizeDigButton,
    row: 3,
};

const closeButton =  {
    label: 'Close',
    render: renderBasicButton,
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
    label: 'Restart from Day 1',
    render: renderBasicButton,
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

const boxBorderColorNeutral = '#fff'; //#7affd5';
const boxBorderColorBad = COLOR_BAD;
const boxBorderColorGood = COLOR_GOOD;
function renderButtonBackground(context, state, button) {
    const neutralColor = button.neutralColor || boxBorderColorNeutral;
    const enabled = !button.isEnabled || button.isEnabled(state, button);
    const active = button.isActive && button.isActive(state, button);
    const lineColor = (state.overButton === button || active) ? (enabled ? boxBorderColorGood : boxBorderColorBad) : neutralColor;
    const fillColor = '#000';
    context.fillStyle = lineColor;
    context.fillRect(button.left, button.top, button.width, button.height);
    context.fillStyle = fillColor;
    context.fillRect(button.left + 1, button.top + 1, button.width - 2, button.height - 2);
    context.fillStyle = lineColor;
    context.fillRect(button.left + 2, button.top + 2, button.width - 4, button.height - 4);
    context.fillStyle = fillColor;
    context.fillRect(button.left + 3, button.top + 3, button.width - 6, button.height - 6);
    context.fillRect(button.left + 8, button.top + 1, button.width - 16, button.height - 2);
    context.fillRect(button.left + 1, button.top + 8, button.width - 2, button.height - 16);
}

const shopButtonAnimationTime = 500;
const shopButtonAnimationStagger = 200;
const shopButton = {
    render(context, state, button, layoutProperties) {
        // There is an animation of this button opening that we need to
        // recalculate its size through.
        if (layoutProperties.animationTime - this.delay <= shopButtonAnimationTime || this.p < 1) {
            this.resize(layoutProperties);
        }
        renderButtonBackground(context, state, button);
        if (this.p < 0.5) return;
        // Draw the diagram line pointing to the robot schemata.
        context.strokeStyle = this.neutralColor || boxBorderColorNeutral;
        //console.log(this.lineStart, this.lineEnd);
        context.beginPath();
        context.moveTo(this.lineStart.x, this.lineStart.y);
        context.lineTo(this.lineEnd.x, this.lineEnd.y);
        context.stroke();
        // Don't render the text in this button until it is full size.
        if (this.p < 1) return;

        const {left, top, width, height} = new Rectangle(button).pad(-5);

        const rowHeight = Math.round(height / 6);
        const halfHeight = Math.round(height / 12);
        const size = Math.min(
            Math.round(rowHeight * .8 / 2) * 2,
            Math.round(width / 24) * 2,
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
        function drawArrow(x, y) {
            context.beginPath();
            context.moveTo(x - 5, y);
            context.lineTo(x + 5, y);
            context.lineTo(x + 3, y - 3);
            context.moveTo(x + 5, y);
            context.lineTo(x + 3, y + 3);
            context.stroke();
        }
        let x = middle;
        let leftText = middle - 7;
        let rightText = middle + 7;
        let y = 2.5 * rowHeight + halfHeight;

        if (button === rangeButton) {
            y = rowHeight + halfHeight;
            const greatNextValue = button.getGreatNextValue(state, button);
            if (greatNextValue > 0) {
                drawText(context, 'Great before depth:', middle, y,
                    {fillStyle: 'white', textAlign: 'center', textBaseline, size}
                );
                y += rowHeight;
                drawArrow(x, y);
                drawText(context, button.getGreatCurrentValue(state, button), leftText, y,
                    {fillStyle: 'white', textAlign: 'right', textBaseline, size}
                );
                drawText(context, greatNextValue, rightText, y,
                    {fillStyle: COLOR_GOOD, textAlign: 'left', textBaseline, size}
                );
                y += rowHeight;
            }
            drawText(context, 'Good before depth:', middle, y,
                {fillStyle: 'white', textAlign: 'center', textBaseline, size}
            );
            y += rowHeight;
            drawArrow(x, y);
            drawText(context, button.getCurrentValue(state, button), leftText, y,
                {fillStyle: 'white', textAlign: 'right', textBaseline, size}
            );
            drawText(context, button.getNextValue(state, button), rightText, y,
                {fillStyle: COLOR_GOOD, textAlign: 'left', textBaseline, size}
            );
        } else if (button === explosionProtectionButton) {
            x = Math.round( 3 * width / 4);
            leftText = x - 7;
            rightText = x + 7;
            y = 2 * rowHeight;
            const maxExplosionProtection = getMaxExplosionProtection(state);
            for (let i = 80; i >= 20; i /= 2) {
                let percentage = i / 100;
                //console.log(percentage, maxExplosionProtection);
                if (percentage > maxExplosionProtection && percentage / 2 < maxExplosionProtection) {
                    percentage = maxExplosionProtection;
                }
                const currentValue = this.getCurrentValue(state, percentage);
                const nextValue = this.getNextValue(state, percentage);
                if (nextValue > 0) {
                    drawText(context, `${percentage * 100}% at depth:`, 0, y,
                        {fillStyle: 'white', textAlign: 'left', textBaseline, size}
                    );
                    drawArrow(x, y);
                    drawText(context, currentValue, leftText, y,
                        {fillStyle: 'white', textAlign: 'right', textBaseline, size}
                    );
                    drawText(context, nextValue, rightText, y,
                        {fillStyle: COLOR_GOOD, textAlign: 'left', textBaseline, size}
                    );
                    y += rowHeight;
                }
            }
        } else {
            drawArrow(x, y);
            drawText(context, button.getCurrentValue(state, button), leftText, y,
                {fillStyle: 'white', textAlign: 'right', textBaseline, size}
            );
            drawText(context, button.getNextValue(state, button), rightText, y,
                {fillStyle: COLOR_GOOD, textAlign: 'left', textBaseline, size}
            );
        }


        x = width - 5;
        y = height - rowHeight + halfHeight;
        const cost = button.getCost(state, button);
        const fillStyle = (cost <= state.saved.score) ? '#4AF' : COLOR_BAD;
        canvas.style.letterSpacing = '2px';
        const costWidth = drawText(context, cost, x, y,
            {fillStyle, textAlign: 'right', textBaseline, size: Math.round(1.5 * size), measure: true}
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
            state = updateSave(state,  {score: state.saved.score - button.getCost(state, button)});
            return button.onPurchase(state, button);
        }
        return state;
    },
    resize({animationTime, shopRectangle}) {
        let p = (animationTime - this.delay) / shopButtonAnimationTime;
        p = Math.min(1, Math.max(0, p));
        this.p = p;
        this.height = Math.round(shopRectangle.height * 0.35 * p);
        this.width = Math.round(shopRectangle.width * 0.45 * p);
        this.left = this.column ? shopRectangle.left + shopRectangle.width * 0.55
            : shopRectangle.left + shopRectangle.width * 0.45 - this.width;
        this.top = this.row ? shopRectangle.top + shopRectangle.height * 0.65
            : shopRectangle.top + shopRectangle.height * 0.35 - this.height;
        this.lineStart = {
            x: this.column ? this.left : this.left + this.width,
            y: this.row ? this.top : this.top + this.height,
        };
        const offset = [
            {x: 0, y: 0}, {x: 5, y: -45},
            {x: -10, y: 15}, {x: 0, y: 32}
        ][this.column + 2 * this.row];
        this.lineEnd = {
            x: Math.round(shopRectangle.left + shopRectangle.width / 2 + offset.x),
            y: Math.round(shopRectangle.top + shopRectangle.height /2 + offset.y),
        }
    },
    neutralColor: '#7affd5',
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
        const maxFuel = this.getNextValue(state, button);
        // Make sure to add the new fuel to the current fuel, in case the user
        // is buying without resting.
        const fuel = state.saved.fuel + (maxFuel - state.saved.maxFuel);
        return updateSave(state, {maxFuel, fuel});
    },
    row: 0, column: 0, delay: 0,
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
        return getDepthOfRange(state, 1.5, 0);
    },
    getGreatCurrentValue(state) {
        return Math.max(0, getDepthOfRange(state, 2.5, 0));
    },
    getNextValue(state) {
        return getDepthOfRange(state, 1.5, 0.5);
    },
    getGreatNextValue(state) {
        return Math.max(0, getDepthOfRange(state, 2.5, 0.5));
    },
    onPurchase(state) {
        return updateSave(state, {range: state.saved.range + 0.5});
    },
    row: 0, column: 1, delay: shopButtonAnimationStagger,
};
const bombDiffuserButton = {
    ...fuelButton,
    getCost(state) {
        return Math.round(25 * Math.pow(2, state.saved.maxBombDiffusers));
    },
    getLabel(){
        return 'Bomb Diffusers';
    },
    getCurrentValue(state) {
        const bonuses = getAchievementBonus(state, ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY);
        return state.saved.maxBombDiffusers + (bonuses ? `(+${bonuses})` : '');
    },
    getNextValue(state) {
        const bonuses = getAchievementBonus(state, ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY);
        return state.saved.maxBombDiffusers + 1 + (bonuses ? `(+${bonuses})` : '');
    },
    onPurchase(state) {
        const bombDiffusers = state.saved.bombDiffusers + 1;
        const maxBombDiffusers = state.saved.maxBombDiffusers + 1;
        return updateSave(state, {bombDiffusers, maxBombDiffusers});
    },
    row: 1, column: 0, delay: 2 * shopButtonAnimationStagger,
};
const explosionProtectionButton = {
    ...fuelButton,
    getCost(state) {
        return Math.round(100 * Math.pow(2, 5 * state.saved.explosionProtection));
    },
    getLabel(){
        return 'Explosion Protection';
    },
    getCurrentValue(state, percent) {
        return Math.max(0, getDepthOfExplosionProtection(state, percent));
    },
    getNextValue(state, percent) {
        return Math.max(getDepthOfExplosionProtection(state, percent, 0.2), 0);
    },
    onPurchase(state) {
        return updateSave(state, {explosionProtection: state.saved.explosionProtection + 0.2});
    },
    row: 1, column: 1, delay: 3 * shopButtonAnimationStagger,
};

function getHUDButtons(state) {
    if (state.showAchievements) {
        const buttons = [closeButton];
        if (getAchievementStat(state, ACHIEVEMENT_EXPLORE_DEPTH_X) >= 200) {
            buttons.push(restartButton);
        }
        return buttons;
    }
    if (state.ship) {
        return [
            upgradeButton,
        ];
    }
    if (state.shop) {
        const maxStartingDepth = Math.min(
            Math.floor(state.saved.lavaDepth - 1),
            getAchievementBonus(state, ACHIEVEMENT_EXPLORE_DEPTH_X),
        );
        const buttons = [
            shipButton,
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

const fuelFrame = r(44, 44, {left: 3*44, image: requireImage('gfx/energy.png')});
function renderHUD(context, state) {
    if (state.leaving || state.incoming) return;
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
    if (!state.shop && !state.showAchievements && !state.ship) {
        const fuelMultiplier = 1 + getAchievementBonus(state, ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY) / 100;
        const fuelBarWidth = Math.min(canvas.width / 2.5, 200 * fuelMultiplier);
        const maxFuel = Math.round(state.saved.maxFuel * fuelMultiplier);
        const fuelBarHeight = fuelFrame.height;
        const fuelBarLeft = 10;
        context.fillStyle = 'black';
        context.fillRect(fuelBarLeft, 10, fuelBarWidth, fuelBarHeight);
        context.fillStyle = '#080';
        const fuelWidth = Math.round(fuelBarWidth * state.saved.fuel / maxFuel);
        const displayFuelWidth = Math.round(fuelBarWidth * state.displayFuel / maxFuel);
        context.fillRect(fuelBarLeft, 10, fuelWidth, fuelBarHeight);
        if (state.displayFuel > state.saved.fuel) {
            const difference = displayFuelWidth - fuelWidth;
            context.fillStyle = '#F00';
            context.fillRect(fuelBarLeft + fuelWidth, 10, difference, fuelBarHeight);
        } else if (state.displayFuel < state.saved.fuel) {
            const difference = fuelWidth - displayFuelWidth;
            context.fillStyle = '#0F0';
            context.fillRect(fuelBarLeft + fuelWidth - difference, 10, difference, fuelBarHeight);
        }
        if (state.overButton && state.overButton.cell) {
            const {row, column} = state.overButton;
            if (canExploreCell(state, row, column) && getFlagValue(state, row, column) !== 2) {
                const fuelCost = getFuelCost(state, row, column);
                const fuelLeft = fuelBarLeft + Math.round(fuelBarWidth * Math.max(0, state.saved.fuel - fuelCost) / maxFuel);
                context.fillStyle = (fuelCost <= state.saved.fuel) ? 'orange' : 'red';
                context.fillRect(fuelLeft, 10, fuelBarLeft + fuelWidth - fuelLeft, fuelBarHeight);
                if (fuelCost <= state.saved.fuel) {
                    const bonusFuelMultiplier = 1 + getAchievementBonus(state, ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS) / 100;
                    const fuelBonus = Math.min(maxFuel, state.saved.fuel + Math.round(bonusFuelMultiplier * fuelCost * 0.1));
                    context.fillStyle = '#0F0';
                    context.fillRect(fuelBarLeft + fuelWidth, 10, Math.round(fuelBarWidth * fuelBonus / maxFuel) - fuelWidth, fuelBarHeight);
                }
            }
        }
        context.strokeStyle = 'white';
        context.lineWidth = 2;
        context.strokeRect(fuelBarLeft, 10, fuelBarWidth, fuelBarHeight);

        const textStyle = {fillStyle: 'white', size: 30, textBaseline: 'middle'};
        const midline = 10 + fuelBarHeight / 2;
        const fuelIconTarget = new Rectangle(fuelFrame).moveTo(8, 10);
        drawImage(context, fuelFrame.image, fuelFrame, fuelIconTarget);
        // Render FUEL + DAY #
        drawText(context, state.saved.fuel, fuelBarLeft + fuelFrame.width - 6, midline, textStyle);
        drawText(context, `DAY ${state.saved.day}`, fuelBarLeft + fuelBarWidth + 10, midline, textStyle);
    }

    // Render buttons
    const layoutProperties = getLayoutProperties(context, state);
    for (const button of getHUDButtons(state)) {
        if (state.lastResized !== button.lastResized) {
            if (button.resize) button.resize(layoutProperties);
            else console.log('no resize function:', button);
            button.lastResized = state.lastResized;
        }
        button.render(context, state, button, layoutProperties);
    }

}
