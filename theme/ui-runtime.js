	function mountLeanUi(ctx) {
		const editors = new Map();
		const processed = new WeakSet();
		const scan = () => {
			const controller = document.querySelector(".post-list-controler");
			if (controller && !controller.querySelector(".nsmax-nq-entry")) {
				const link = document.createElement("a");
				link.className = "nsmax-nq-entry";
				link.href = "https://nodequality.com";
				link.target = "_blank";
				link.rel = "noopener noreferrer";
				link.title = "NodeQuality 测机";
				link.append(toolIcon("gauge"), document.createTextNode("NQ"));
				controller.append(link);
			}
			if (!/^\/post-\d+/.test(location.pathname)) return;
			for (const editor of document.querySelectorAll(".md-editor")) {
				if (editors.has(editor)) continue;
				const body = editor.querySelector("#editor-body") || editor;
				const cm = editor.querySelector(".CodeMirror")?.CodeMirror;
				const input = editor.querySelector("textarea:not(.CodeMirror textarea)");
				if (!cm && !input) continue;
				editor.classList.add("nsmax-compact-reply");
				const heading = document.createElement("h2");
				heading.className = "nsmax-editor-heading";
				heading.textContent = "发表回复";
				const controls = document.createElement("div");
				controls.className = "nsmax-editor-controls";
				const preview = document.createElement("div");
				preview.className = "nsmax-editor-preview post-content";
				preview.hidden = true;
				preview.setAttribute("aria-label", "回复预览");
				let previewing = false;
				const render = () => {
					if (previewing) preview.replaceChildren(renderMessageMarkdown(cm ? cm.getValue() : input.value));
				};
				const action = (label, icon, callback) => {
					const button = document.createElement("button");
					button.type = "button";
					button.title = label;
					button.setAttribute("aria-label", label);
					button.setAttribute("aria-pressed", "false");
					button.append(toolIcon(icon), document.createTextNode(label));
					button.addEventListener("click", () => callback(button), { signal: ctx.signal });
					controls.append(button);
				};
				action("Markdown", "code", button => {
					const on = editor.classList.toggle("nsmax-editor-tools");
					button.setAttribute("aria-pressed", String(on));
					cm?.refresh();
				});
				action("附件", "image", () => (editor.querySelector(".nspp-upload-choose") || editor.querySelector('.mde-toolbar [title="图片"],.mde-toolbar [title="上传图片"]'))?.click());
				action("表情", "comment", button => {
					const on = editor.classList.toggle("nsmax-editor-emoji");
					button.setAttribute("aria-pressed", String(on));
				});
				action("预览", "eye", button => {
					previewing = !previewing;
					preview.hidden = !previewing;
					editor.classList.toggle("nsmax-editor-previewing", previewing);
					button.setAttribute("aria-pressed", String(previewing));
					render();
					if (!previewing) { cm?.refresh(); (cm || input).focus(); }
				});
				body.prepend(heading);
				body.append(preview);
				const submit = editor.querySelector(".topic-select,.submit-row");
				if (submit) submit.prepend(controls);
				else editor.append(controls);
				if (cm) cm.on("change", render);
				else input.addEventListener("input", render, { signal: ctx.signal });
				editors.set(editor, () => { cm?.off("change", render); heading.remove(); controls.remove(); preview.remove(); });
			}
			// Only group explicit replies to an earlier floor already present on this page.
			// Moving the existing node preserves native actions, anchors and drafts.
			const list = document.querySelector("ul.comments");
			if (!list) return;
			const floors = new Map(Array.from(list.querySelectorAll("li.content-item[id]"), item => [item.id, item]));
			for (const [id, item] of floors) {
				if (processed.has(item)) continue;
				const paragraph = item.querySelector("article.post-content > p:first-child");
				if (!paragraph || !/^\s*@/.test(paragraph.textContent)) continue;
				const link = paragraph.querySelector("a[href]");
				if (!link) continue;
				const url = new URL(link.href, location.href);
				const parentId = url.hash.slice(1);
				const post = location.pathname.match(/^\/post-(\d+)-/);
				if (url.origin !== location.origin || !url.pathname.startsWith("/post-" + post?.[1] + "-") || !/^\d+$/.test(parentId) || Number(parentId) >= Number(id)) continue;
				const parent = floors.get(parentId);
				if (!parent || parent === item || item.contains(parent)) continue;
				let replies = parent.querySelector(":scope > .nsmax-nested-replies");
				if (!replies) {
					replies = document.createElement("ul");
					replies.className = "nsmax-nested-replies";
					replies.setAttribute("aria-label", "楼中楼回复");
					parent.append(replies);
				}
				replies.append(item);
				processed.add(item);
			}
		};
		const stop = ctx.watch(scan);
		return () => { stop(); for (const dispose of editors.values()) dispose(); editors.clear(); };
	}
	var leanUiFeature = { id: "sb-page-controls", defaults: { enabled: true }, mount: mountLeanUi };
