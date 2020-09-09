ace.define("ace/mode/spl_highlight_rules",["require","exports","module","ace/lib/oop","ace/lib/lang", "ace/mode/text_highlight_rules"], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

var SPLHighlightRules = function(commandSyntax) {
    
    /**
     * builds tokens based on parsed sytax
     * @param  {object} commandRules 
     * @return {array} array of tokens 
     */
    this.buildCommandTokens =  function(commandRules) {
        var tokens = [],
            index = 0,
            nonPushArray = [],
            arg;
            
        commandRules.other.forEach(function(otherRule) {
            if (this.tokens[otherRule]) {
                tokens.push(this.tokens[otherRule]);
            }
        }.bind(this));
        
        if (commandRules.args.length) {
            nonPushArray = [];
            for (index = 0; index < commandRules.args.length; index++) {
                arg = commandRules.args[index];
                if (arg.valueType && this.$rules[arg.valueType + 'State']) {
                    tokens.push(new Token({
                        token: ['argument', 'operator'],
                        regex: new RegExp("\\b(" + arg.key + ")(=)"),
                        push: arg.valueType+'State'
                    }));
                } else {
                    nonPushArray.push(arg.key);
                }
            }
            if (nonPushArray.length) {
                tokens.push(new Token({
                    token: ['argument', 'operator'],
                    regex: new RegExp("\\b(" + nonPushArray.join('|') + ")(=)"),
                    push: 'generalArgState'
                }));
            }
        }
        if (commandRules.functions.length) {
            var withParen = [],
                withOutParen = [];
            commandRules.functions.forEach(function(functionObject) {
                withParen.push(functionObject.name);
                if (functionObject.parenOptional) {
                    withOutParen.push(functionObject.name);
                }
            }.bind(this));
            
            tokens.push(new Token({
                token: ['function', 'text'],
                regex: new RegExp('\\b(' + withParen.join('|') + ')(\\s*\\(\\s*)')
            }));
            
            if (withOutParen.length) {
                tokens.push(new Token({
                    token: ['function', 'text'],
                    regex: new RegExp('\\b(' + withOutParen.join('|') + ')(,\\s*|\\s+|$)')
                }));
            }
        }
        if (commandRules.keywords.length) {
            tokens.push(new Token({
                token: 'modifier',
                regex: new RegExp("\\b(" + commandRules.keywords.join('|') + ")\\b")
            }));
        }
        return tokens;
    };
    
    this.buildRules = function() {
        var allCommandRules= {};
        for (var command in commandSyntax) {
            allCommandRules[command] = this.tokens.commandArgs.concat(this.buildCommandTokens(commandSyntax[command]));
        }
        allCommandRules.start = allCommandRules['search-command'] || [this.tokens.pipe];
        this.addRules(allCommandRules);
    };
    
    function Token(attrs) {
        for (var attr in attrs) {
            this[attr] = attrs[attr];
        }
    }
    
    /*
     * makes a copy of the Token and sets the next to nextState.
     */
    Token.prototype.then = function (nextState) {
        var copyAttr = {};
        for (var key in this) {
            copyAttr[key] = this[key];
        }
        var copy = new this.constructor(copyAttr);
        copy.next = nextState;
        return copy;
    };
    
    /**
     * determines the next state, called by the ace tokenizer
     * 
     * needed for case ...|top user limit=10 showperc=true|rex ...
     * in this case true| will match as a valid boolean (this.tokens.bool) value so the | will not be matched 
     * with this.tokens.pipe so this.tokens.bool will need to set the next state to command
     */
    var nextIfPipe = function(currentState, stack) {
        if (this.matchPipe) {
            return 'command';
        }
        return currentState;
    };
    
    /**
     * determines the next state, called by the ace tokenizer
     * 
     * simular to nextIfPipe but handles the case where it needs to pop if the next token is not a command
     */
    var popOrPipe = function(currentState, stack) {
        if (this.matchPipe) {
            return 'command';
        }
        stack.shift();
        return stack.shift() || 'start';
    };
    
    this.tokens = {};
    
    // must define so that escaped quotes don't match with quotes
    this.tokens.escapedDoubleQuote = new Token({
        token: 'text',
        regex: /\\"/
    });
    
    this.tokens.doubleQuote = new Token({
        token: 'quoted',
        regex: /"/,
        push: 'inDoubleQuote'
    });
    
    this.tokens.pipe = new Token({
        token: 'pipe',
        regex: /\|/,
        next: 'command'
    });
    
    this.tokens.subsearchStart = new Token({
        token: 'subsearch',
        regex: /[[]/,
        push: 'command'
    });
    
    this.tokens.subsearchEnd = new Token({
        token: 'subsearch',
        regex: /[\]]/,
        next: 'pop'
    });
    
    this.tokens['int'] = new Token({
        token: function(match1, match2) {
            if (match2 === "|") {
                this.matchPipe = true;
                return ['number', 'pipe'];
            }
            if (match2 === "]") {
                return ['number', 'subsearch'];
            }
            this.matchPipe = false;
            return ['number', 'text'];
        },
        regex: /([+-]?\d+)(\s+|,|\)|\(|\||\]|$)/,
        next: nextIfPipe
    });
    
    this.tokens.num = new Token({
        token: function(match1, match2) {
            if (match2 === "|") {
                this.matchPipe = true;
                return ['number', 'pipe'];
            }
            if (match2 === "]") {
                return ['number', 'subsearch'];
            }
            this.matchPipe = false;
            return ['number', 'text'];
        },
        regex: /([+-]?\d+(?:.\d+)?)(\s+|,|\)|\(|\||\]|$)/,
        next: nextIfPipe
    });
    
    this.tokens.bool = new Token({
        token: function(match1, match2) {
            if (match2 === "|") {
                this.matchPipe = true;
                return ['boolean', 'pipe'];
            }
            if (match2 === "]") {
                return ['boolean', 'subsearch'];
            }
            this.matchPipe = false;
            return ['boolean', 'text'];
        },
        regex: /(True|False|T|F|0|1)(\s+|,|\)|\(|\||\]|$)/,
        next: nextIfPipe
    });
    
    this.tokens['boolean-operator-or'] = new Token({
        token: function(match) {
            // Hack to make boolean operators case sensitive 
            if (match === 'OR') {
                return 'modifier';
            }
            return 'text';
        },
        regex: /\bOR\b/
    });
    
    this.tokens['boolean-operator-and'] = new Token({
        token: function(match) {
            // Hack to make boolean operators case sensitive 
            if (match === 'AND') {
                return 'modifier';
            }
            return 'text';
        },
        regex: /\bAND\b/
    });
       
    this.tokens['boolean-operator-not'] = new Token({
        token: function(match) {
            // Hack to make boolean operators case sensitive 
            if (match === 'NOT') {
                return 'modifier';
            }
            return 'text';
        },
        regex: /\bNOT\b/
    });
    
    this.tokens.command = new Token({
        token: function(match) {
            if (this.$rules[match + "-command"]) {
                this.tokens.command.next = match + "-command";
                return 'command';
            } else {
                this.tokens.command.next = "commandArgs";
                return 'text';
            }
        }.bind(this),
        regex:  /\b\w+\b/
    });
    
    this.tokens.invalidArg = new Token({
        token: 'invalid',
        regex: /\s+|\S+\s+/
    });
    
    // defalut tokens for commands
    this.tokens.commandArgs = [
        this.tokens.escapedDoubleQuote,
        this.tokens.doubleQuote,
        this.tokens.pipe,
        this.tokens.subsearchStart,
        this.tokens.subsearchEnd,
        {
            caseInsensitive: true
        }
    ];
    
    this.$rules = {
        start : [
            this.tokens.escapedDoubleQuote,
            this.tokens.doubleQuote,
            this.tokens.pipe,
            this.tokens.subsearchStart,
            this.tokens.subsearchEnd
        ],
        command: [
            this.tokens.escapedDoubleQuote,
            this.tokens.doubleQuote,
            this.tokens.command,
            this.tokens.pipe,
            this.tokens.subsearchStart,
            this.tokens.subsearchEnd
        ],
        commandArgs: this.tokens.commandArgs,
        boolState: [
            this.tokens.bool.then(popOrPipe),
            this.tokens.invalidArg.then('pop'),
            {
                caseInsensitive: true
            }
        ],
        intState: [
            this.tokens['int'].then(popOrPipe),
            this.tokens.invalidArg.then('pop')
        ],
        numState: [
            this.tokens.num.then(popOrPipe),
            this.tokens.invalidArg.then('pop')
        ],
        generalArgState: [
            new Token ({
                token: 'text',
                // Matching excaped double quotes, double quoted strings, wildcarded strings and strings with _ and - in them.
                regex: /((?:\\"|[\w\*\-_]+|"(?:\\"|.)*?")+)/,
                next: 'pop'
            }),
            new Token({
                token: 'invalid',
                regex: /\s|\W/,
                next: 'pop'
            })
        ],
        inDoubleQuote: [
            new Token({
                token: 'quoted',
                regex: /\\"/
            }),
            new Token({
                token: 'quoted',
                regex: /"/,
                next: 'pop'
            }),
            new Token({
                token: 'quoted',
                regex: /./
            })
        ]
    };
    
    this.buildRules();
    this.normalizeRules();
};
oop.inherits(SPLHighlightRules, TextHighlightRules);

exports.SPLHighlightRules = SPLHighlightRules;
});
ace.define("ace/mode/spl",["require","exports","module","ace/lib/oop","ace/lib/lang", "ace/mode/text","ace/mode/spl_highlight_rules"], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var SPLHighlightRules = require("./spl_highlight_rules").SPLHighlightRules;

var Mode = function(commandSyntax) {
    this.$highlightRules = new SPLHighlightRules(commandSyntax);
};
oop.inherits(Mode, TextMode);

(function() {
    this.$id = "ace/mode/spl";
}).call(Mode.prototype);

exports.Mode = Mode;
});