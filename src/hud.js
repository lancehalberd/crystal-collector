const {
    WIDTH,
    HEIGHT,
} = require('gameConstants');
const Rectangle = require('Rectangle');
const { drawImage } = require('draw');

function renderBasicButton(context, state, button) {
    let label = button.label;
    if (button.getLabel) label = button.getLabel(state, button);
    context.fillStyle = state.overButton === button ? '#EEE' : '#CCC';
    if (button.isEnabled && !button.isEnabled(state, button)) {
        context.fillStyle = state.overButton === button ? '#F00' : '#F88';
    }
    context.fillRect(button.left, button.top, button.width, button.height);
    context.fillStyle = 'black';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `${button.height - 2}px sans-serif`;
    context.fillText(label, button.left + button.width / 2, button.top + button.height / 2);
}

const sleepButton = {
    label: 'Sleep',
    render: renderBasicButton,
    onClick(state) {
        return nextDay(state);
    },
    left: WIDTH - 100,
    top: 10,
    width: 90,
    height: 20,
};

const digButton = {
    ...sleepButton,
    label: 'Dig',
    onClick(state) {
        return {...state, shop: false, fuel: state.saved.maxFuel};
    },
};

const shopButton = {
    render: renderBasicButton,
    getLabel(state, button) {
        return `$${button.getCost(state, button)}: ${button.getName(state, button)}`
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
    }
};

const fuelButton = {
    ...shopButton,
    getCost(state) {
        return Math.round(state.saved.maxFuel * Math.log10(state.saved.maxFuel) * Math.log10(state.saved.maxFuel) / 4);
    },
    getName(state, button){
        return `Max Fuel ${this.getNextValue(state, button)}`;
    },
    getNextValue(state) {
        return Math.round(state.saved.maxFuel * 1.2 + 50);
    },
    onPurchase(state, button) {
        return {...state, saved: {...state.saved, maxFuel: this.getNextValue(state, button)}};
    },
    left: 50,
    top: 50,
    height: 30,
    width: 400,
};
const rangeButton = {
    ...fuelButton,
    getCost(state) {
        return Math.round(100 * Math.pow(1.5, 2 * (state.saved.range - 0.2) - 1));
    },
    getName(state){
        return `Range @${state.saved.maxDepth} ${getRangeAtDepth(state, state.saved.maxDepth, 0.5).toFixed(2)}`;
    },
    onPurchase(state) {
        return {...state, saved: {...state.saved, range: state.saved.range + 0.5}};
    },
    top: fuelButton.top + fuelButton.height + 10,
};

function getHUDButtons(state) {
    if (state.shop) {
        return [
            digButton,
            fuelButton,
            rangeButton,
        ];
    }
    return [
        sleepButton
    ];
}

function renderHUD(context, state) {
    // Draw DEPTH indicator
    if (!state.shop && state.overCell && state.overCell.row >= 0) {
        context.textAlign = 'left';
        context.textBaseline = 'bottom';
        context.font = `36px sans-serif`;
        context.fillStyle = 'black';
        context.lineWidth = 1;
        context.strokeStyle = 'white';
        const depth = getDepth(state, state.overCell.row, state.overCell.column);
        context.fillText(`DEPTH: ${depth}`, 10, HEIGHT - 10);
        context.strokeText(`DEPTH: ${depth}`, 10, HEIGHT - 10);
    }
    // Draw SCORE indicator
    context.textAlign = 'right';
    context.textBaseline = 'bottom';
    context.font = `36px sans-serif`;
    context.fillStyle = '#4AF';
    context.lineWidth = 1;
    context.strokeStyle = 'white';
    context.fillText(state.saved.score, WIDTH - 10, HEIGHT - 10);
    context.strokeText(state.saved.score, WIDTH - 10, HEIGHT - 10);
    const scoreWidth = context.measureText(state.saved.score).width;
    const iconRectangle = new Rectangle(crystalFrame).scale(2);
    drawImage(context, crystalFrame.image, crystalFrame,
        iconRectangle.moveCenterTo(WIDTH - 10 - scoreWidth - 5 - iconRectangle.width / 2, HEIGHT - 10 - 20)
    );

    // Draw FUEL indicator
    if (!state.shop) {
        context.fillStyle = 'black';
        context.fillRect(10, 10, 200, 20);
        context.fillStyle = '#080';
        const fuelWidth = Math.round(200 * state.fuel / state.saved.maxFuel);
        context.fillRect(10, 10, fuelWidth, 20);
        if (state.overCell) {
            const {row, column} = state.overCell;
            if (canExploreCell(state, row, column) && getFlagValue(state, row, column) !== 2) {
                const fuelCost = getFuelCost(state, row, column);
                const fuelLeft = 10 + Math.round(200 * Math.max(0, state.fuel - fuelCost) / state.saved.maxFuel);
                context.fillStyle = (fuelCost <= state.fuel) ? 'orange' : 'red';
                context.fillRect(fuelLeft, 10, 10 + fuelWidth - fuelLeft, 20);
            }
        }
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.font = `19px sans-serif`;
        context.fillStyle = 'white';
        context.fillText('FUEL ' + state.fuel, 15, 9);
        context.strokeStyle = 'white';
        context.lineWidth = 2;
        context.strokeRect(10, 10, 200, 20);
    }

    // Render buttons
    for (const button of getHUDButtons(state)) {
        button.render(context, state, button);
    }

    context.textAlign = 'right';
    context.textBaseline = 'top';
    context.font = `20px sans-serif`;
    context.fillStyle = 'black';
    context.fillText(`DAY ${state.saved.day}`, WIDTH - 110, 10);
}

module.exports = {
    renderHUD,
    getHUDButtons,
};

const { nextDay } = require('state');
const { canExploreCell, getFuelCost, getFlagValue, getDepth, getRangeAtDepth } = require('digging');
const { crystalFrame } = require('sprites');

