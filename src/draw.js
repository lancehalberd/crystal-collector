function drawImage(context, image, source, target) {
    context.drawImage(
        image,
        source.left, source.top, source.width, source.height,
        target.left, target.top, target.width, target.height
    );
}

function embossText(context, {left, top, text, color = 'white', backgroundColor = 'black'}) {
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

const cachedFonts = {};
function drawText(context, text, x, y,
    {fillStyle = 'black', maxWidth, strokeStyle, lineWidth = 1, textAlign = 'left', textBaseline = 'bottom', size = 20}
) {
    text = `${text}`;
    x = Math.round(x / 2) * 2;
    y = Math.round(y / 2) * 2;
    size = Math.round(size / 2) * 2;

    // Drawing text performs poorly in firefox. Since we tend to show only a small subset of characters
    // in different fonts, just cache each character as an image.
    const key = `${fillStyle}-${strokeStyle}-${lineWidth}-${size}`;
    const cachedFont = cachedFonts[key] = cachedFonts[key] || {};
    let textWidth = 0;
    for (const c of text) {
        let cachedLetter = cachedFont[c];
        if (!cachedLetter) {
            cachedLetter = document.createElement('canvas');
            const cachedLetterContext = cachedLetter.getContext('2d');
            cachedLetterContext.imageSmoothingEnabled = false;
            cachedLetterContext.font = `${size}px VT323`;
            const w = cachedLetterContext.measureText(c).width;
            cachedLetter.width = w;
            cachedLetter.height = size;
            cachedLetterContext.font = `${size}px VT323`;
            cachedLetterContext.textBaseline = 'top';
            cachedLetterContext.textAlign = 'left';
            if (fillStyle) {
                cachedLetterContext.fillStyle = fillStyle;
                cachedLetterContext.fillText(c, 0, 0);
            }
            if (strokeStyle) {
                cachedLetterContext.strokeStyle = strokeStyle;
                cachedLetterContext.lineWidth = lineWidth;
                cachedLetterContext.strokeText(c, 0, 0);
            }
            cachedFont[c] = cachedLetter;
        }
        textWidth += cachedLetter.width;
    }

    if (textBaseline === 'middle') y = Math.round(y - size / 2);
    else if (textBaseline === 'bottom') y = Math.round(y - size);

    if (textAlign === 'center') x = Math.round(x - textWidth / 2);
    else if (textAlign === 'right') x = Math.round(x - textWidth);

    for (const c of text) {
        let cachedLetter = cachedFont[c];
        context.drawImage(cachedLetter,
            0, 0, cachedLetter.width, cachedLetter.height,
            x, y, cachedLetter.width, cachedLetter.height,
        );
        x += cachedLetter.width;
    }
    return textWidth;
}
function measureText(context, text, props) {
    return drawText(context, text, 0, 0, {...props, fillStyle: false, strokeStyle: false});
}

module.exports = {
    drawImage,
    drawRectangle,
    drawText,
    embossText,
    measureText,
};
