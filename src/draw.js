const { WIDTH, HEIGHT } = require('gameConstants');

function drawImage(context, image, source, target) {
    context.drawImage(
        image,
        source.left, source.top, source.width, source.height,
        target.left, target.top, target.width, target.height
    );
}

const tintCanvas = document.createElement('canvas');
tintCanvas.width = WIDTH;
tintCanvas.height = HEIGHT;
const tintContext = tintCanvas.getContext('2d');
tintContext.imageSmoothingEnabled = false;

const drawTintedImage = (context, image, tint, amount, source, target) => {
    context.save();
    // First make a solid color in the shape of the image to tint.
    tintContext.save();
    tintContext.fillStyle = tint;
    tintContext.clearRect(0, 0, source.width, source.height);
    tintContext.drawImage(image, source.left, source.top, source.width, source.height, 0, 0, source.width, source.height);
    tintContext.globalCompositeOperation = "source-in";
    tintContext.fillRect(0, 0, source.width, source.height);
    tintContext.restore();
    // Next draw the untinted image to the target.
    context.drawImage(image, source.left, source.top, source.width, source.height, target.left, target.top, target.width, target.height);
    // Finally draw the tint color on top of the target with the desired opacity.
    context.globalAlpha *= amount; // This needs to be multiplicative since we might be drawing a partially transparent image already.
    context.drawImage(tintCanvas, 0, 0, source.width, source.height, target.left, target.top, target.width, target.height);
    context.restore();
};

const embossText = (context, {left, top, text, color = 'white', backgroundColor = 'black'}) => {
    context.fillStyle = backgroundColor;
    context.fillText(text, left + 1, top + 1);
    context.fillStyle = color;
    context.fillText(text, left, top);
}

function drawRectangle(context, rectangle, {fillStyle, strokeStyle, lineWidth = 1}) {
    if (fillStyle) {
        context.fillStyle = fillStyle;
        context.fillRect(rectangle.left, rectangle.top, rectangle.width, rectangle.height);
    }
    if (strokeStyle) {
        context.strokeStyle = strokeStyle;
        context.lineWidth = lineWidth;
        context.strokeRect(rectangle.left, rectangle.top, rectangle.width, rectangle.height);
    }
}

function drawText(context, text, x, y,
    {fillStyle = 'black', strokeStyle, lineWidth = 1, textAlign = 'left', textBaseline = 'bottom', size = 20, measure = false}
) {
    context.textAlign = textAlign;
    context.textBaseline = textBaseline;
    context.font = `${size}px sans-serif`;
    if (fillStyle) {
        context.fillStyle = fillStyle;
        context.fillText(text, x, y);
    }
    if (strokeStyle) {
        context.strokeStyle = strokeStyle;
        context.lineWidth = lineWidth;
        context.strokeText(text, x, y);
    }
    if (measure) {
        return context.measureText(text).width;
    }
}
function measureText(context, text, props) {
    return drawText(context, text, 0, 0, {...props, fillStyle: false, strokeStyle: false, measure: true});
}

module.exports = {
    drawImage,
    drawTintedImage,
    drawRectangle,
    drawText,
    embossText,
    measureText,
};
