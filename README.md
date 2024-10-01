# TERMVAS

A simple library for dynamic terminal printing.

## API

Using Termvas is very simple.

### Initialization

To initialize Termvas, use the following:

```javascript
let ui = new (require('termvas'))();
```

Now you can write individual characters or text anywhere on the screen! Termvas natively supports basic colors. Use 'default' to revert to your terminal's default colors.

###Set Character

To set a single character with optional colors:

```javascript
ui.setChar(x, y, character, foregroundColor, backgroundColor);
```

### Example:

```javascript
ui.setChar(1, 1, 'H', 'red', 'blue');
```

### Write Text

To write a string of text with optional colors:
```javascript
ui.writeText(x, y, text, foregroundColor, backgroundColor);
```
### Example:

```javascript
ui.writeText(5, 5, 'Hello, World!', 'red', 'blue');
```

### Render screen
```javascript
ui.render();
```

Note: The foregroundColor and backgroundColor fields default to 'default' (the terminal's default colors). If not specified, the function will render text using these default values.

##Color Support

The following colors are supported for both the foreground and background:

 - black
 - red
 - green
 - yellow
 - blue
 - magenta
 - cyan
 - white
 - default (Terminal's default color)
