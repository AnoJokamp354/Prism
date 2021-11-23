/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 * MIT license http://www.opensource.org/licenses/mit-license.php/
 * @author Lea Verou http://lea.verou.me
 */
(function () {
	// Private helper vars
	var lang = /\blang(?:uage)?-(?!\*)(\w+)\b/i;
	var _ = self.Prism = {
		languages: {
			insertBefore: function (inside, before, insert, root) {
				root = root || _.languages;
				var grammar = root[inside];
				var ret = {};
				for (var token in grammar) {
					if (grammar.hasOwnProperty(token)) {
						if (token == before) {
							for (var newToken in insert) {
								if (insert.hasOwnProperty(newToken)) {
									ret[newToken] = insert[newToken];
								}
							}
						}
						ret[token] = grammar[token];
					}
				}
				return root[inside] = ret;
			},
			DFS: function (o, callback) {
				for (var i in o) {
					callback.call(o, i, o[i]);
					if (Object.prototype.toString.call(o) === '[object Object]') {
						_.languages.DFS(o[i], callback);
					}
				}
			}
		},
		highlightAll: function (async, callback) {
			var elements = document.querySelectorAll('code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code');
			for (var i = 0, element; element = elements[i++];) {
				_.highlightElement(element, async === true, callback);
			}
		},
		highlightElement: function (element, async, callback) {
			// Find language
			var language, grammar, parent = element;
			while (parent && !lang.test(parent.className)) {
				parent = parent.parentNode;
			}
			if (parent) {
				language = (parent.className.match(lang) || [, ''])[1];
				grammar = _.languages[language];
			}
			if (!grammar) {
				return;
			}
			// Set language on the element, if not present
			element.className = element.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;
			// Set language on the parent, for styling
			parent = element.parentNode;
			if (/pre/i.test(parent.nodeName)) {
				parent.className = parent.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;
			}
			var code = element.textContent.trim();
			if (!code) {
				return;
			}
			code = code.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/\u00a0/g, ' ');
			//console.time(code.slice(0,50));
			var env = {
				element: element,
				language: language,
				grammar: grammar,
				code: code
			};
			_.hooks.run('before-highlight', env);
			if (async && self.Worker) {
				var worker = new Worker(_.filename);
				worker.onmessage = function (evt) {
					env.highlightedCode = Token.stringify(JSON.parse(evt.data));
					env.element.innerHTML = env.highlightedCode;
					callback && callback.call(env.element);
					//console.timeEnd(code.slice(0,50));
					_.hooks.run('after-highlight', env);
				};
				worker.postMessage(JSON.stringify({
					language: env.language,
					code: env.code
				}));
			} else {
				env.highlightedCode = _.highlight(env.code, env.grammar)
				env.element.innerHTML = env.highlightedCode;
				callback && callback.call(element);
				_.hooks.run('after-highlight', env);
				//console.timeEnd(code.slice(0,50));
			}
		},
		highlight: function (text, grammar) {
			return Token.stringify(_.tokenize(text, grammar));
		},
		tokenize: function (text, grammar) {
			var Token = _.Token;
			var strarr = [text];
			var rest = grammar.rest;
			if (rest) {
				for (var token in rest) {
					grammar[token] = rest[token];
				}
				delete grammar.rest;
			}
			tokenloop: for (var token in grammar) {
				if (!grammar.hasOwnProperty(token) || !grammar[token]) {
					continue;
				}
				var pattern = grammar[token],
					inside = pattern.inside,
					lookbehind = !! pattern.lookbehind || 0;
				pattern = pattern.pattern || pattern;
				for (var i = 0; i < strarr.length; i++) { // Don’t cache length as it changes during the loop
					var str = strarr[i];
					if (strarr.length > text.length) {
						// Something went terribly wrong, ABORT, ABORT!
						break tokenloop;
					}
					if (str instanceof Token) {
						continue;
					}
					pattern.lastIndex = 0;
					var match = pattern.exec(str);
					if (match) {
						if (lookbehind) {
							lookbehind = match[1].length;
						}
						var from = match.index - 1 + lookbehind,
							match = match[0].slice(lookbehind),
							len = match.length,
							to = from + len,
							before = str.slice(0, from + 1),
							after = str.slice(to + 1);
						var args = [i, 1];
						if (before) {
							args.push(before);
						}
						var wrapped = new Token(token, inside ? _.tokenize(match, inside) : match);
						args.push(wrapped);
						if (after) {
							args.push(after);
						}
						Array.prototype.splice.apply(strarr, args);
					}
				}
			}
			return strarr;
		},
		hooks: {
			all: {},
			add: function (name, callback) {
				var hooks = _.hooks.all;
				hooks[name] = hooks[name] || [];
				hooks[name].push(callback);
			},
			run: function (name, env) {
				var callbacks = _.hooks.all[name];
				if (!callbacks || !callbacks.length) {
					return;
				}
				for (var i = 0, callback; callback = callbacks[i++];) {
					callback(env);
				}
			}
		}
	};
	var Token = _.Token = function (type, content) {
			this.type = type;
			this.content = content;
		};
	Token.stringify = function (o) {
		if (typeof o == 'string') {
			return o;
		}
		if (Object.prototype.toString.call(o) == '[object Array]') {
			for (var i = 0; i < o.length; i++) {
				o[i] = Token.stringify(o[i]);
			}
			return o.join('');
		}
		var env = {
			type: o.type,
			content: Token.stringify(o.content),
			tag: 'span',
			classes: ['token', o.type],
			attributes: {}
		};
		if (env.type == 'comment') {
			env.attributes['spellcheck'] = 'true';
		}
		_.hooks.run('wrap', env);
		var attributes = '';
		for (var name in env.attributes) {
			attributes += name + '="' + (env.attributes[name] || '') + '"';
		}
		return '<' + env.tag + ' class="' + env.classes.join(' ') + '" ' + attributes + '>' + env.content + '</' + env.tag + '>';
	};
	if (!self.document) {
		// In worker
		self.addEventListener('message', function (evt) {
			var message = JSON.parse(evt.data),
				lang = message.language,
				code = message.code;
			self.postMessage(JSON.stringify(_.tokenize(code, _.languages[lang])));
			self.close();
		}, false);
		return;
	}
	// Get current script and highlight
	var script = document.getElementsByTagName('script');
	script = script[script.length - 1];
	if (script) {
		_.filename = script.src;
		if (document.addEventListener && !script.hasAttribute('data-manual')) {
			document.addEventListener('DOMContentLoaded', _.highlightAll);
		}
	}
})();

// Plugin to make entity title show the real entity, idea by Roman Komarov
Prism.hooks.add('wrap', function (env) {
	if (env.type === 'entity') {
		env.attributes['title'] = env.content.replace(/&/, '&');
	}
});


Prism.languages.html = {
	'comment': /<!--[\w\W]*?--(>|>)/g,
	'prolog': /<\?.+?\?>/,
	'doctype': /<!DOCTYPE.+?>/,
	'cdata': /<!\[CDATA\[[\w\W]+?]]>/i,
	'tag': {
		pattern: /<\/?[\w:-]+\s*[\w\W]*?>/gi,
		inside: {
			'tag': {
				pattern: /^<\/?[\w:-]+/i,
				inside: {
					'punctuation': /^<\/?/,
					'namespace': /^[\w-]+?:/
				}
			},
			'attr-value': {
				pattern: /=(('|")[\w\W]*?(\2)|[^\s>]+)/gi,
				inside: {
					'punctuation': /=/g
				}
			},
			'punctuation': /\/?>/g,
			'attr-name': {
				pattern: /[\w:-]+/g,
				inside: {
					'namespace': /^[\w-]+?:/
				}
			}
		}
	},
	'entity': /&#?[\da-z]{1,8};/gi
};

Prism.languages.css = {
	'comment': /\/\*[\w\W]*?\*\//g,
	'atrule': /@[\w-]+?(\s+.+)?(?=\s*{|\s*;)/gi,
	'url': /url\((["']?).*?\1\)/gi,
	'selector': /[^\{\}\s][^\{\}]*(?=\s*\{)/g,
	'property': /(\b|\B)[a-z-]+(?=\s*:)/ig,
	'string': /("|')(\\?.)*?\1/g,
	'important': /\B!important\b/gi,
	'ignore': /&(lt|gt|amp);/gi,
	'punctuation': /[\{\};:]/g
};

Prism.languages.php = {
	/* Warna Abu-Abu */
	'comment': {
		pattern: /(^|[^\\])(\/\*[\w\W]*?\*\/|\/\/.*?(\r?\n|$))/g,
		lookbehind: true
	},
	'purple': /\b(php|PHP|null|base)\b/g,
	/* Warna Merah Italic */
	'keyword': /\b(trigger_error|exit|error_reporting|mysqli_error|session_start|session_destroy|public|import|virtual|abstract|continue|for|new|switch|assert|default|goto|get|set|package|synchronized|boolean|do|if|foreach|private|this|break|double|implements|protected|throw|byte|else|throws|case|enum|instanceof|return|transient|catch|extends|int|bool|short|try|char|final|interface|static|void|id|class|finally|long|strictfp|volatile|const|float|native|super|while|endwhile|Destroy|value)\b/g,
	/* Warna Kuning */
	'boolean': /\b(true|false)\b/g,
	/* Warna Hijau Tua */
	'general': /\b(array_shift|strtotime|strlen|strpos|set_magic_quotes_runtime|get_magic_quotes_gpc|version_compare)\b/g,
	/* Warna Coklat */
	'brown': /\b(array|file_get_contents|phpversion)\b/g,
	/* Warna Hijau Muda */
	'green-young': /\b(_GET|_POST|_get|_post|_SESSION|_SERVER|substr|ini_get|ini_set|stripslashes)\b/g,
	/* Warna Aqua */
	'aqua': /\b(HTTP_USER_AGENT|HTTP_ACCEPT|HTTP_PROFILE|HTTP_X_WAP_PROFILE|PHP_AUTH_USER|PHP_AUTH_PW|set_time_limit|location|Location|method|Method|action|Action|explode|fopen|fwrite|fclose|mysqli_connect|mysqli_query|mysqli_fetch_assoc|date)\b/g,
	
	'android': /\b(time|gmdate|header|isset|preg_match|android|blackberry|iphone|opera|palm|windows|generic)\b/g,
	/* Warna Merah Biasa */
	'red': /\b(include|file_exists|as|md5|die|empty|json_encode)\b/g,
	
	'prolog': /<\?.+?\?>/,
	'doctype': /<!DOCTYPE.+?>/,
	'cdata': /<!\[CDATA\[[\w\W]+?]]>/i,
	'tag': {
		pattern: /<\/?[\w:-]+\s*[\w\W]*?>/gi,
		inside: {
			'tag': {
				pattern: /^<\/?[\w:-]+/i,
				inside: {
					'punctuation': /^<\/?/,
					'namespace': /^[\w-]+?:/
				}
			},
			'attr-value': {
				pattern: /=(('|")[\w\W]*?(\2)|[^\s>]+)/gi,
				inside: {
					'punctuation': /=/g
				}
			},
			'punctuation': /\/?>/g,
			'attr-name': {
				pattern: /[\w:-]+/g,
				inside: {
					'namespace': /^[\w-]+?:/
				}
			}
		}
	},
	'entity': /&#?[\da-z]{1,8};/gi,

};

Prism.languages.javascript = {
	'comment': {
		pattern: /(^|[^\\])(\/\*[\w\W]*?\*\/|\/\/.*?(\r?\n|$))/g,
		lookbehind: true
	},
	'string': /("|')(\\?.)*?\1/g,
	'regex': {
		pattern: /(^|[^/])\/(?!\/)(\[.+?]|\\.|[^/\r\n])+\/[gim]{0,3}(?=\s*($|[\r\n,.;})]))/g,
		lookbehind: true
	},
	'keyword': /\b(var|let|if|else|while|do|for|return|in|instanceof|function|new|with|typeof|try|catch|finally|null|break|continue)\b/g,
	'boolean': /\b(true|false)\b/g,
	'number': /\b-?(0x)?\d*\.?\d+\b/g,
	'operator': /[-+]{1,2}|!|=?<|=?>|={1,2}|(&){1,2}|\|?\||\?|\*|\//g,
	'ignore': /&(lt|gt|amp);/gi,
	'punctuation': /[{}[\];(),.:]/g
};

Prism.languages.java = {
	/* Warna Abu-Abu */
	'comment': {
		pattern: /(^|[^\\])(\/\*[\w\W]*?\*\/|\/\/.*?(\r?\n|$))/g,
		lookbehind: true
	},


	'string': /("|')(\\?.)*?\1/g,
	/* Warna Merah Italic */
	'keyword': /\b(public|import|virtual|abstract|continue|for|new|switch|assert|default|goto|get|set|package|synchronized|boolean|do|if|foreach|private|this|break|double|implements|protected|throw|byte|else|throws|case|enum|instanceof|return|transient|catch|extends|int|bool|short|try|char|final|interface|static|void|class|finally|long|strictfp|volatile|const|float|native|super|while|Destroy|value)\b/g,
	/* Warna Kuning */
	'boolean': /\b(true|false)\b/g,
	/* Warna Hijau Tua */
	'general': /\b(alpha|zero|Infinity|Rad2Deg|A|Alpha0|Alpha1|Alpha2|Alpha3|Alpha4|Alpha5|Alpha6|Alpha7|Alpha8|Alpha9|collider|DownArrow|forward|LeftArrow|UpArrow|RightArrow|RightAlt|LeftAlt|B|Backquote|Backspace|Break|LeftBracket|RightBracket|JoystickButton0|JoystickButton1|JoystickButton2|JoystickButton3|JoystickButton4|JoystickButton5|JoystickButton6|JoystickButton8|JoystickButton9|JoystickButton10|JoystickButton11|JoystickButton12|JoystickButton13|JoystickButton14|JoystickButton15|JoystickButton16|JoystickButton17|JoystickButton18|JoystickButton19|Joystick1Button0|Joystick1Button1|Joystick1Button2|Joystick1Button3|Joystick1Button4|Joystick1Button5|Joystick1Button6|Joystick1Button8|Joystick1Button9|Joystick1Button10|Joystick1Button11|Joystick1Button12|Joystick1Button13|Joystick1Button14|Joystick1Button15|Joystick1Button16|Joystick1Button17|Joystick1Button18|Joystick1Button19|Joystick2Button0|Joystick2Button1|Joystick2Button2|Joystick2Button3|Joystick2Button4|Joystick2Button5|Joystick2Button6|Joystick2Button8|Joystick2Button9|Joystick2Button10|Joystick2Button11|Joystick2Button12|Joystick2Button13|Joystick2Button14|Joystick2Button15|Joystick2Button16|Joystick2Button17|Joystick2Button18|Joystick2Button19|Joystick4Button0|Joystick4Button1|Joystick4Button2|Joystick4Button3|Joystick4Button4|Joystick4Button5|Joystick4Button6|Joystick4Button8|Joystick4Button9|Joystick4Button10|Joystick4Button11|Joystick4Button12|Joystick4Button13|Joystick4Button14|Joystick4Button15|Joystick4Button16|Joystick4Button17|Joystick4Button18|Joystick4Button19|Joystick5Button0|Joystick5Button1|Joystick5Button2|Joystick5Button3|Joystick5Button4|Joystick5Button5|Joystick5Button6|Joystick5Button8|Joystick5Button9|Joystick5Button10|Joystick5Button11|Joystick5Button12|Joystick5Button13|Joystick5Button14|Joystick5Button15|Joystick5Button16|Joystick5Button17|Joystick5Button18|Joystick5Button19|Joystick6Button0|Joystick6Button1|Joystick6Button2|Joystick6Button3|Joystick6Button4|Joystick6Button5|Joystick6Button6|Joystick6Button8|Joystick6Button9|Joystick6Button10|Joystick6Button11|Joystick6Button12|Joystick6Button13|Joystick6Button14|Joystick6Button15|Joystick6Button16|Joystick6Button17|Joystick6Button18|Joystick6Button19|Joystick7Button0|Joystick7Button1|Joystick7Button2|Joystick7Button3|Joystick7Button4|Joystick7Button5|Joystick7Button6|Joystick7Button8|Joystick7Button9|Joystick7Button10|Joystick7Button11|Joystick7Button12|Joystick7Button13|Joystick7Button14|Joystick7Button15|Joystick7Button16|Joystick7Button17|Joystick7Button18|Joystick7Button19|Joystick8Button0|Joystick8Button1|Joystick8Button2|Joystick8Button3|Joystick8Button4|Joystick8Button5|Joystick8Button6|Joystick8Button8|Joystick8Button9|Joystick8Button10|Joystick8Button11|Joystick8Button12|Joystick8Button13|Joystick8Button14|Joystick8Button15|Joystick8Button16|Joystick8Button17|Joystick8Button18|Joystick8Button19|C|CapsLock|clip|Comma|Clear|LeftCommand|LeftControl|RightCommand|RightControl|rotation|Delete|D|PageDown|E|End|F|F1|F2|F3|F4|F5|F6|F10|F11|F12|F13|F14|F15|G|Greater|H|Hash|Home|I|Insert|J|K|Keypad0|Keypad1|Keypad2|Keypad3|Keypad4|Keypad5|Keypad6|Keypad7|Keypad8|KeypadEnter|KeypadEquals|KeypadMinus|KeypadPlus|KeypadDivide|KeypadPeriod|L|LeftWindows|RightWindows|LeftShift|ScrollLock|M|main|mousePosition|Menu|Mouse0|Mouse1|Mouse2|Mouse3|Mouse4|Mouse5|Mouse6|N|None|Numlock|O|P|PageDown|PageUp|Pause|Print|position|DoubleQuote|Qoute|Question|Return|RightParen|LeftParen|RightShift|Q|R|S|T|text|Tab|timeScale|U|Underscore|V|velocity|W|X|x|Y|y|Z|z|Space|Escape|transform|tag|deltaTime|right|left|up|down|localScale)\b/g,
	/* Warna Coklat */
	'brown': /\b(LoadLevel|IsPointerOverGameObject|StartCoroutine|Distance|MoveTowards|Instantiate|GetMouseButtonDown|GetMouseButtonUp|ScreenToWorldPoint|Euler|Abs|Atan2|AddForce|Clamp|Find|FindObjectOfType|FindObjectsOfType|FindGameObjectWithTag|FindGameObjectsWithTag|FindWithTag|GetKey|GetFloat|GetInt|GetString|Lerp|LookAt|Translate|SetBool|SetActive|SetFloat|SetInt|SetString|ToString|GetComponent|OnTriggerEnter2D|OnTriggerStay2D|OnTriggerExit2D|Start|Update|Find|OverlapCircle|OverlapBox|OverlapBoxAll|OverlapCapsule|OverlapCapsuleAll|OverlapCollider|PlayOneShot|Play|SetActive|Quit|Raycast|Rotate)\b/g,
	/* Warna Hijau Muda */
	'green-young': /\b(gameObject)\b/g,
	/* Warna Ungu */
	'purple': /\b(null|base)\b/g,
	/* Warna Hijau Lime */
	'android': /\b(android)\b/g,
	/* Warna Merah Biasa */
	'red': /\b(import|using)\b/g,
	/* Warna Aqua */
	'aqua': /\b(Application|Override|Camera|CompareTag|EventSystem|Image|Invoke|Text|Animator|Rigidbody2D|RaycastHit2D|GameObject|AudioSource|MonoBehaviour|Mathf|Transform|LayerMask|Vector2|Vector3|Vector4|Slider|Collider2D|KeyCode|Time|Input|Physics|Physics2D|PhysicMaterial|PhysicsMaterial2D|PlayerPrefs|RectTransform)\b/g,
	/* Warna Kuning */
	'number': /\b0b[01]+\b|\b0x[\da-f]*\.?[\da-fp\-]+\b|\b\d*\.?\d+[e]?[\d]*[df]\b|\W\d*\.?\d+\b/gi,
	/* Warna Biru */
	'operator': /([-+]{1,2}|!|=?<|=?>|={1,2}|(&){1,2}|\|?\||\?|\*|\/|%|\^|(<){2}|($gt;){2,3}~)/g,
	/* Warna Biru */
	'ignore': /&(lt|gt|amp);/gi,
	/* Warna Putih */
	'punctuation': /[{}[\];(),.:]/g,
};



if (Prism.languages.html) {
	Prism.languages.insertBefore('html', 'tag', {
		'style': {
			pattern: /(<|<)style[\w\W]*?(>|>)[\w\W]*?(<|<)\/style(>|>)/ig,
			inside: {
				'tag': {
					pattern: /(<|<)style[\w\W]*?(>|>)|(<|<)\/style(>|>)/ig,
					inside: Prism.languages.html.tag.inside
				},
				rest: Prism.languages.css
			}
		}
	});
}
if (Prism.languages.html) {
	Prism.languages.insertBefore('html', 'tag', {
		'script': {
			pattern: /(<|<)script[\w\W]*?(>|>)[\w\W]*?(<|<)\/script(>|>)/ig,
			inside: {
				'tag': {
					pattern: /(<|<)script[\w\W]*?(>|>)|(<|<)\/script(>|>)/ig,
					inside: Prism.languages.html.tag.inside
				},
				rest: Prism.languages.javascript
			}
		}
	});
}
