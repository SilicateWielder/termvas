let inputHandler = new (require('input-handler'))(); // For future use.
let EventHandler = require('events');

// CHANGES:
//  - Simplified rendering code
//  - cursor rendering implemented (WIP)

class termvas extends EventHandler {
    constructor(rendermouse = false) {
        super();

		process.stdout.write('\x1b[2J');

        this.renderMouse = rendermouse;
        this.cursorHidden = false;
        this.mouseX = 0;
        this.mouseY = 0;
        if (this.renderMouse) {
            inputHandler.on('mouse-move', (pos) => {
                //console.log(`Mouse moved to x:${pos.x}, y:${pos.y}`);
                // Coordinates get adjusted to match 0-indexing.
                this.mouseX = pos.x - 1;
                this.mouseY = pos.y - 1;
            });
        }

        this.fgMatrix = {
            'black': '30',
            'red': '31',
            'green': '32',
            'yellow': '33',
            'blue': '34',
            'magenta': '35',
            'cyan': '36',
            'white': '37',
            'default': '39',
        };

        this.bgMatrix = {
            'black': '40',
            'red': '41',
            'green': '42',
            'yellow': '43',
            'blue': '44',
            'magenta': '45',
            'cyan': '46',
            'white': '47',
            'default': '49',
        };

        this.defaultCell = { fg: 'default', bg: 'default', ch: ' ', wasCursor: false };

        this.width = process.stdout.columns;
        this.height = process.stdout.rows;

        this.updateBuffer = this.#initScreenBuffer(this.width, this.height);
        this.buffer = this.#initScreenBuffer(this.width, this.height);
        this.bufferUpdated = false;
    }

    // Initialize a screen buffer with default elements
    #initScreenBuffer(width, height, element = this.defaultCell) {
        let buffer = [];
        for (let h = 0; h < height; h++) {
            let row = [];
            for (let w = 0; w < width; w++) {
                row.push({ ...element });
            }
            buffer.push(row);
        }

        return buffer;
    }

    // Pushes updates to the relevant parts of the buffer.
    setChar(x, y, text, fg, bg) {
        if(x < 1 || y < 1) throw new Error("Invalid screenspace coordinates: Value cannot be less than 1.");
        let xPos = (x < 1) ? (0) : (x - 1);
        let yPos = (y < 1) ? (0) : (y - 1);

        let source = this.buffer[yPos][xPos];
        let ref = { ...source };

        if (ref.ch !== text) ref.ch = text;
        if (ref.fg !== fg && fg !== undefined && fg !== null) ref.fg = fg;
        if (ref.bg !== bg && bg !== undefined && bg !== null) ref.bg = bg;

        this.updateBuffer[yPos][xPos] = { ...ref };
        this.bufferUpdated = true;  // Mark buffer as updated
    }

    // Writes text to a specific portion of the buffer.
	writeText(x, y, text, fg = 'default', bg = 'default') {
		for(let c = 0; c < text.length; c++) {
			this.setChar(x + c, y, text[c], fg, bg);
		}
	}

    // Gets color code for foreground
    #getFgCode(fgColor) {

        return this.fgMatrix[fgColor];
    }

    // Gets color code for background.
    #getBgCode(bgColor) {
        return this.bgMatrix[bgColor];
    }

    // Renders the whole screen.
    render() {

        // Hide cursor and set up exit event.
        if (!this.cursorHidden) {
            process.stdout.write('\x1b[?25l'); // Hide cursor.
            this.cursorHidden = true;

            process.on('exit', (code) => {
                process.stdout.write('\x1b[?25h'); // Restore cursor.
            });

            process.on('SIGINT', (code) => {
                process.stdout.write('\x1b[?25h'); // Restore cursor.
            });
        }

        // Iterate through cells.
        for(let h = 0; h < this.height; h++) {
            for(let w = 0; w < this.width; w++) {
                let oldCell = this.buffer[h][w]; // Original cell.
                let newCell = this.updateBuffer[h][w]; // Mask to apply if different;

                //Check if the cell is not equal to the values of the defaultCell.
                let fgChanged = (this.defaultCell.fg !== newCell.fg);
                let bgChanged = (this.defaultCell.bg !== newCell.bg);
                let chChanged = (this.defaultCell.ch !== newCell.ch);

                let cellNeedsUpdate = (fgChanged || bgChanged || chChanged);
                let cellIsCursor = (this.mouseX === w) && (this.mouseY === h);
                let cellWasCursor = oldCell.wasCursor && !cellIsCursor;

                if (cellIsCursor) {
                    process.stdout.write(`\x1b[${h + 1};${w + 1}H\x1b[${this.#getFgCode('white')}m\x1b[${this.#getBgCode('white')}m \x1b[0m`);
                    this.buffer[h][w].wasCursor = true;
                } else if (cellWasCursor && !cellNeedsUpdate) {
                    process.stdout.write(`\x1b[${h + 1};${w + 1}H\x1b[${this.#getFgCode(oldCell.fg)}m\x1b[${this.#getBgCode(oldCell.bg)}m${oldCell.ch}\x1b[0m`);
                    this.buffer[h][w].wasCursor = false;
                } else if (cellNeedsUpdate) {
                    //console.log('updating!'); // This never gets called. For some reason we're not getting to the cell-needs-update block.
                    this.buffer[h][w] = { ...this.updateBuffer[h][w] };
                    process.stdout.write(`\x1b[${h + 1};${w + 1}H\x1b[${this.#getFgCode(this.buffer[h][w].fg)}m\x1b[${this.#getBgCode(this.buffer[h][w].bg)}m${this.buffer[h][w].ch}\x1b[0m`);
                    this.updateBuffer[h][w] = { ...this.defaultCell };
                }               

                // For Reference.
                //process.stdout.write(`\x1b[${py};${px}H\x1b[${this.#getFgCode(fg)}m\x1b[${this.#getBgCode(bg)}m${ch}\x1b[0m`);
            }
        }
    }
}

// Simple test to ensure setChar and rendering is working as expected.
function selftest() {
    let testDisplay = new termvas(true);
    testDisplay.setChar(1, 1, 'H');
    testDisplay.setChar(1, 2, 'E');
    testDisplay.setChar(1, 3, 'L');
    testDisplay.setChar(1, 4, 'L');
    testDisplay.setChar(1, 5, 'O');

    testDisplay.setChar(3, 1, 'W');
    testDisplay.setChar(3, 2, 'O');
    testDisplay.setChar(3, 3, 'R');
    testDisplay.setChar(3, 4, 'L');
    testDisplay.setChar(3, 5, 'D');

    testDisplay.writeText(1, 6, 'HELLO', 'red');
    testDisplay.writeText(12, 6, 'WORLD', 'blue');

    setInterval(() => {
        // Special character to ensure characters are being overwritten.
        testDisplay.setChar(9, 4, '' + Math.floor(Math.random() * 9));
        testDisplay.writeText(9, 5, '' + testDisplay.mouseX + ' '.repeat(3));
        testDisplay.writeText(9, 6, '' + testDisplay.mouseY + ' '.repeat(3));
        testDisplay.render();
    }, 32);
}

module.exports = termvas
