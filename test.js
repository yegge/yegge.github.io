    <script>
        const editor = document.getElementById('input-text');
        const fileListElem = document.getElementById('file-list');
        const currentFileLabel = document.getElementById('current-file');
        
        let projectHandle; 
        let activeFileHandle;

        // Toolbar Logic
        function insertMD(before, after = "") {
            editor.focus();
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            const text = editor.value;
            editor.setRangeText(before + text.substring(start, end) + after, start, end, 'select');
        }

        function insertEmbed() {
            const url = prompt("Enter media URL (YouTube, MP4, MP3) or iframe code:");
            if (!url) return;
            
            let embedCode = url;
            if (url.includes("<iframe") || url.includes("<audio") || url.includes("<video")) {
                embedCode = url;
            } else if (url.includes("youtube.com/watch?v=") || url.includes("youtu.be/")) {
                let videoId = "";
                if (url.includes("watch?v=")) {
                    videoId = url.split("watch?v=")[1].split("&")[0];
                } else if (url.includes("youtu.be/")) {
                    videoId = url.split("youtu.be/")[1].split("?")[0];
                }
                if (videoId) {
                    embedCode = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
                }
            } else if (url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".ogg")) {
                embedCode = `<video controls width="100%"><source src="${url}"></video>`;
            } else if (url.endsWith(".mp3") || url.endsWith(".wav") || url.endsWith(".m4a")) {
                embedCode = `<audio controls style="width:100%;"><source src="${url}"></audio>`;
            } else {
                embedCode = `<iframe src="${url}" width="100%" height="400" frameborder="0"></iframe>`;
            }
            insertMD(embedCode + '\n\n');
        }

        // Folder Sync (The "Trigger")
        async function syncFolder() {
            try {
                if (!window.showDirectoryPicker) {
                    throw new Error("Your browser or current setup doesn't support the File System Access API. Try using Chrome or running this on a local server (e.g., npx http-server).");
                }
                projectHandle = await window.showDirectoryPicker();
                
                // Prevent selecting the wrong folder
                const folderName = projectHandle.name.toLowerCase();
                if (folderName === 'src' || folderName === 'docs') {
                    alert(`⚠️ You selected the '/${projectHandle.name}' folder.\n\nPlease select the ROOT project folder (e.g. 'crmbase.net') instead. The app needs access to the entire project to save to both /src and /Docs.`);
                    projectHandle = null;
                    return;
                }
                
                refreshFileList();
            } catch (err) { 
                console.error(err);
                alert("Folder Sync Error: " + err.message);
            }
        }

        async function refreshFileList() {
            fileListElem.innerHTML = '';
            let srcFolder;
            
            try {
                srcFolder = await projectHandle.getDirectoryHandle('src');
            } catch {
                return alert("Please ensure your project has a '/src' and a '/Docs' folder.");
            }

            async function scanDir(dirHandle, pathPrefix = "") {
                for await (const entry of dirHandle.values()) {
                    if (entry.kind === 'file' && entry.name.endsWith('.md')) {
                        const div = document.createElement('div');
                        div.className = 'file-item';
                        div.textContent = pathPrefix + entry.name;
                        div.onclick = () => loadFile(entry);
                        fileListElem.appendChild(div);
                    } else if (entry.kind === 'directory') {
                        await scanDir(entry, pathPrefix + entry.name + "/");
                    }
                }
            }

            await scanDir(srcFolder);
        }

        async function loadFile(handle) {
            activeFileHandle = handle;
            const file = await handle.getFile();
            editor.value = await file.text();
            currentFileLabel.textContent = `Active: ${handle.name}`;
            
            document.querySelectorAll('.file-item').forEach(i => i.classList.remove('active'));
            event.target.classList.add('active');
        }

        async function saveAll() {
            if (!projectHandle || !editor.value.trim()) return alert("Sync a folder and enter content first.");

            const content = editor.value;
            const filename = activeFileHandle ? activeFileHandle.name.replace('.md', '') : content.split('\n')[0].replace(/[#*`]/g, '').trim() || "document";
            const catInput = document.getElementById('category-input').value.trim();
            const subCatInput = document.getElementById('subcategory-input').value.trim();
            
            try {
                // Determine directories and depths
                let targetSrcDir = await projectHandle.getDirectoryHandle('src', { create: true });
                let targetDocsDir = await projectHandle.getDirectoryHandle('Docs', { create: true });
                let depth = 0;
                let relPath = "";

                if (catInput) {
                    targetSrcDir = await targetSrcDir.getDirectoryHandle(catInput, { create: true });
                    targetDocsDir = await targetDocsDir.getDirectoryHandle(catInput, { create: true });
                    depth++;
                    relPath += `${catInput}/`;

                    if (subCatInput) {
                        targetSrcDir = await targetSrcDir.getDirectoryHandle(subCatInput, { create: true });
                        targetDocsDir = await targetDocsDir.getDirectoryHandle(subCatInput, { create: true });
                        depth++;
                        relPath += `${subCatInput}/`;
                    }
                }

                // 1. Save Markdown to /src
                const mdFile = await targetSrcDir.getFileHandle(`${filename}.md`, { create: true });
                const mdWritable = await mdFile.createWritable();
                await mdWritable.write(content);
                await mdWritable.close();

                // 2. Save HTML to /Docs
                const htmlFile = await targetDocsDir.getFileHandle(`${filename}.html`, { create: true });
                const generatedHtml = generateHTML(content, filename, depth);
                const htmlWritable = await htmlFile.createWritable();
                await htmlWritable.write(generatedHtml);
                await htmlWritable.close();

                // 3. Update /Docs/index.html
                try {
                    const docsRoot = await projectHandle.getDirectoryHandle('Docs');
                    const indexFileHandle = await docsRoot.getFileHandle('index.html');
                    const indexFile = await indexFileHandle.getFile();
                    const indexHtml = await indexFile.text();
                    
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(indexHtml, 'text/html');
                    const listContainer = doc.querySelector('.directory-list');
                    
                    if (listContainer) {
                        const fileLinkHref = `${relPath}${filename}.html`;
                        const existingLink = doc.querySelector(`a[href="${fileLinkHref}"]`);
                        
                        if (!existingLink) {
                            const sizeBytes = new Blob([generatedHtml]).size;
                            let sizeStr = sizeBytes + ' bytes';
                            if (sizeBytes > 1024) sizeStr = (sizeBytes / 1024).toFixed(1) + ' KB';
                            
                            const newItem = doc.createElement('a');
                            newItem.href = fileLinkHref;
                            newItem.className = 'list-item';
                            newItem.innerHTML = `
                                <div class="file-name"><span class="icon-html"></span> ${filename}.html</div>
                                <div class="file-type">HTML Document</div>
                                <div class="file-size">${sizeStr}</div>
                            `;

                            let targetContainer = listContainer;
                            let insertAfterElement = targetContainer.querySelector('.list-header');

                            if (catInput) {
                                let catGroup = Array.from(listContainer.querySelectorAll('.category-group')).find(el => el.getAttribute('data-category') === catInput);
                                if (!catGroup) {
                                    catGroup = doc.createElement('div');
                                    catGroup.className = 'category-group';
                                    catGroup.setAttribute('data-category', catInput);
                                    catGroup.innerHTML = `
                                        <div class="category-header"><span class="folder-icon"></span> ${catInput}</div>
                                        <div class="category-content"></div>
                                    `;
                                    listContainer.appendChild(catGroup);
                                }
                                targetContainer = catGroup.querySelector('.category-content');
                                insertAfterElement = null;

                                if (subCatInput) {
                                    let subGroup = Array.from(targetContainer.querySelectorAll('.subcategory-group')).find(el => el.getAttribute('data-subcategory') === subCatInput);
                                    if (!subGroup) {
                                        subGroup = doc.createElement('div');
                                        subGroup.className = 'subcategory-group';
                                        subGroup.setAttribute('data-subcategory', subCatInput);
                                        subGroup.innerHTML = `
                                            <div class="subcategory-header"><span class="folder-icon"></span> ${subCatInput}</div>
                                            <div class="subcategory-content"></div>
                                        `;
                                        targetContainer.appendChild(subGroup);
                                    }
                                    targetContainer = subGroup.querySelector('.subcategory-content');
                                }
                            }

                            if (insertAfterElement && insertAfterElement.nextSibling) {
                                insertAfterElement.parentNode.insertBefore(newItem, insertAfterElement.nextSibling);
                            } else {
                                targetContainer.appendChild(newItem);
                            }
                            
                            const updatedHtml = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
                            const indexWritable = await indexFileHandle.createWritable();
                            await indexWritable.write(updatedHtml);
                            await indexWritable.close();
                        }
                    }
                } catch (idxErr) {
                    console.error("Could not update Docs/index.html automatically:", idxErr);
                }

                alert(`Success: ${filename} updated dynamically!`);
                refreshFileList();
            } catch (err) {
                console.error(err);
                alert("Save failed. Ensure folder permissions are granted.");
            }
        }

        function generateHTML(md, title, depth = 0) {
            const body = marked.parse(md);
            let backPrefix = "";
            for (let i = 0; i < depth; i++) backPrefix += "../";

            return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
            <style>
                body { background:#000; color:#b0b0b0; font-family:sans-serif; padding:50px; max-width:800px; margin:0 auto; line-height:1.6; user-select: none; -webkit-user-select: none; }
                h1,h2 { color:#fff; border-bottom:1px solid #333; padding-bottom:10px; }
                a { color:#ff9800; pointer-events: auto; }
                pre { background:#111; padding:35px 15px 15px 15px; border:1px solid #333; color:#ffb74d; position: relative; border-radius: 6px; }
                pre code { user-select: text; -webkit-user-select: text; }
                .copy-btn { position: absolute; top: 8px; left: 8px; background: #333; color: #fff; border: 1px solid #555; padding: 4px 8px; font-size: 11px; cursor: pointer; border-radius: 4px; font-weight: bold; text-transform: uppercase; }
                .copy-btn:hover { background: #ff9800; color: #000; border-color: #ff9800; }
                .back-link { display:inline-block; margin-bottom:20px; text-decoration:none; color:#ff9800; font-weight:bold; }
                .back-link:hover { text-decoration:underline; }
            </style>
            <script>
                // Document Lockdown
                document.addEventListener('contextmenu', event => event.preventDefault());
                document.onkeydown = function(e) {
                    if (e.keyCode == 123 || (e.ctrlKey && e.shiftKey && e.keyCode == 73) || (e.ctrlKey && e.keyCode == 85) || (e.metaKey && e.altKey && e.keyCode == 73) || (e.metaKey && e.keyCode == 85)) {
                        return false;
                    }
                };

                // Copy Buttons for Code Blocks
                document.addEventListener("DOMContentLoaded", () => {
                    document.querySelectorAll('pre').forEach(pre => {
                        const btn = document.createElement('button');
                        btn.className = 'copy-btn';
                        btn.innerText = 'Copy';
                        btn.onclick = () => {
                            const code = pre.querySelector('code');
                            const text = code ? code.innerText : pre.innerText;
                            navigator.clipboard.writeText(text);
                            btn.innerText = 'Copied!';
                            setTimeout(() => btn.innerText = 'Copy', 2000);
                        };
                        pre.appendChild(btn);
                    });
                });
            </script>
