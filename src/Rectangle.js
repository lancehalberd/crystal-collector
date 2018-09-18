class Rectangle {

    static defineByCenter(x, y, width, height) {
        return new Rectangle(x - width / 2, y - height / 2, width, height);
    }

    static defineFromPoints(A, B) {
        // convert arrays to objects.
        if (A.length) A = {x: A[0], y: A[1]};
        if (B.length) B = {x: B[0], y: B[1]};
        return new Rectangle(Math.min(A.x, B.x), Math.min(A.y, B.y), Math.abs(A.x - B.x), Math.abs(A.y - B.y));
    }

    static defineFromElement($element) {
        return new Rectangle(
            $element.offset().left, $element.offset().top,
            $element.outerWidth(true), $element.outerHeight(true)
        );
    }

    // Image needs to be loaded already.
    static defineFromImage(image) {
        return new Rectangle(0, 0, image.width, image.height);
    }

    static collision(A, B) {
        return !(
            A.top + A.height <= B.top ||
            A.top >= B.top + B.height ||
            A.left + A.width <= B.left ||
            A.left >= B.left + B.width
        );
    }

    constructor(left = 0, top = 0, width = 0, height = 0) {
        if (typeof(left) === 'object') {
            top = left.top || 0;
            width = left.width || 0;
            height = left.height || 0;
            left = left.left || 0;
        }
        this.left = left;
        this.top = top;
        // Don't allow negative width/height. Update left/top so
        // that width/height are always positive.
        if (width <= 0) {
            width *= -1;
            this.left -= width;
        }
        this.width = width;
        if (height <= 0) {
            height *= -1;
            this.top -= height;
        }
        this.height = height;
        this.right = left + width;
        this.bottom = top + height;
    }

    snap() {
        return new Rectangle(Math.round(this.left), Math.round(this.top), Math.round(this.width), Math.round(this.height));
    }

    translate(dx, dy) {
        return new Rectangle(this.left + dx, this.top + dy, this.width, this.height);
    }

    moveTo(x, y) {
        return new Rectangle(x, y, this.width, this.height);
    }

    moveCenterTo(x, y) {
        return this.moveTo(x - this.width / 2, y - this.height / 2);
    }

    resize(width, height) {
        return new Rectangle(this.left, this.top, width, height);
    }

    pad(padding) {
        return new Rectangle(
            this.left - padding, this.top - padding,
            this.width + 2 * padding, this.height + 2 * padding
        );
    }

    scale(scale) {
        return new Rectangle(this.left * scale, this.top * scale, this.width * scale, this.height * scale);
    }

    scaleFromCenter(scale) {
        const center = this.getCenter();
        return this.scaleFromPoint(center[0], center[1], scale);
    }

    scaleFromPoint(x, y, scale) {
        return this.translate(-x, -y).scale(scale).translate(x, y);
    }

    stretch(scaleX, scaleY) {
        return new Rectangle(this.left * scaleX, this.top * scaleY, this.width * scaleX, this.height * scaleY);
    }

    stretchFromCenter(scaleX, scaleY) {
        const center = this.getCenter();
        return this.stretchFromPoint(center[0], center[1], scaleX, scaleY);
    }

    stretchFromPoint(x, y, scaleX, scaleY) {
        return this.translate(-x, -y).stretch(scaleX, scaleY).translate(x, y);
    }

    getCenter() {
        return [this.left + this.width / 2, this.top + this.height / 2];
    }

    containsPoint(x, y) {
        return !(y < this.top || y > (this.bottom) || x < this.left || x > this.right);
    }

    // By default overlapping at a single point counts, but if includeBoundary is false, then the overlap counts
    // only if the overlapping area has positive area,
    overlapsRectangle(rectangle, includeBoundary = true) {
        if (includeBoundary) {
            return !(this.bottom < rectangle.top || this.top > rectangle.bottom
                || this.right < rectangle.left || this.left > rectangle.right);
        }
        return !(this.bottom <= rectangle.top || this.top >= rectangle.bottom
            || this.right <= rectangle.left || this.left >= rectangle.right);
    }
}

module.exports = Rectangle;