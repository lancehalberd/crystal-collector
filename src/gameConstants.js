const EDGE_LENGTH = 50;
const LONG_EDGE = EDGE_LENGTH * Math.cos(Math.PI / 6);
const SHORT_EDGE = EDGE_LENGTH * Math.sin(Math.PI / 6);
const COLUMN_WIDTH = EDGE_LENGTH + SHORT_EDGE;
const ROW_HEIGHT = LONG_EDGE * 2;
module.exports = {
    WIDTH: 800,
    HEIGHT: 550,
    FRAME_LENGTH: 20,
    EDGE_LENGTH,
    COLUMN_WIDTH,
    ROW_HEIGHT,
    SHORT_EDGE,
    LONG_EDGE,
};
