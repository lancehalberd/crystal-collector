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

module.exports = {
    drawImage,
    drawTintedImage,
    embossText,
};
