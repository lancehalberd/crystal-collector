/* globals Image */
const { FRAME_LENGTH } = require('gameConstants');

const Rectangle = require('Rectangle');

const assetVersion = assetVersion || 0.4;
const images = {};
function loadImage(source, callback) {
    images[source] = new Image();
    images[source].onload = () => callback();
    images[source].src = source + '?v=' + assetVersion;
    images[source].originalSource = source;
    return images[source];
}
let numberOfImagesLeftToLoad = 0;
function requireImage(imageFile) {
    if (images[imageFile]) return images[imageFile];
    numberOfImagesLeftToLoad++;
    return loadImage(imageFile, () => {
        images[imageFile].imageIsLoaded = true;
        numberOfImagesLeftToLoad--
    });
}
const initialImagesToLoad = [

];
for (const initialImageToLoad of initialImagesToLoad) {
    requireImage(initialImageToLoad);
}

const i = (width, height, source) => ({left: 0, top: 0, width, height, image: requireImage(source)});
const r = (width, height, props) => ({left: 0, top: 0, width, height, ...props});
// Sets the anchor for a frame's geometry based on percent values passed for h and v.
// Default anchor is h=v=0 is the top left. Center would be h=v=0.5. Left center
// would be h=0, v=0.5
const a = (rectangle, h, v) => {
    const hitBox = rectangle.hitBox || rectangle;
    return {...rectangle, anchor: {
        x: hitBox.left + h * hitBox.width, y: hitBox.top + v * hitBox.height,
    }};
};

const createAnimation = (source, rectangle, {x = 0, y = 0, rows = 1, cols = 1, top = 0, left = 0, duration = 8, frameMap} = {}, props) => {
    let frames = [];
    const image = requireImage(source);
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            frames[row * cols + col] = {
                ...rectangle,
                left: left + rectangle.width * (x + col),
                top: top + rectangle.height * (y + row),
                image
            };
        }
    }
    // Say an animation has 3 frames, but you want to order them 0, 1, 2, 1, then pass frameMap = [0, 1, 2, 1],
    // to remap the order of the frames accordingly.
    if (frameMap) {
       frames = frameMap.map(originalIndex => frames[originalIndex]);
    }
    return {frames, frameDuration: duration, ...props};
};

const getFrame = (animation, animationTime) => {
    let frameIndex = Math.floor(animationTime / (FRAME_LENGTH * (animation.frameDuration || 1)));
    if (animation.loop === false) { // You can set this to prevent an animation from looping.
        frameIndex = Math.min(frameIndex, animation.frames.length - 1);
    }
    if (animation.loopFrame && frameIndex >= animation.frames.length) {
        frameIndex -= animation.loopFrame;
        frameIndex %= (animation.frames.length - animation.loopFrame);
        frameIndex += animation.loopFrame;
    }
    return animation.frames[frameIndex % animation.frames.length];
};
const getAnimationLength = (animation) => animation.frames.length * animation.frameDuration;
const getHitBox = (animation, animationTime) => {
    const frame = getFrame(animation, animationTime);
    const scaleX = frame.scaleX || 1;
    const scaleY = frame.scaleY || 1;
    return (frame.hitBox ?
        new Rectangle(frame.hitBox) :
        new Rectangle(frame).moveTo(0, 0)).stretch(scaleX, scaleY);
};

module.exports = {
    requireImage,
    r, i, a,
    getFrame,
    getAnimationLength,
    createAnimation,
    getHitBox,
};
