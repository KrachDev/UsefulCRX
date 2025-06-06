// ==UserScript==
// @name         SteamButFree
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Simple Script to get downloads to steam
// @author       krachDev
// @match        https://store.steampowered.com/app/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

// Get game name from Steam page
const pathParts = window.location.pathname.split('/');
const rawTitle = pathParts[3] || "";
const targetGame = decodeURIComponent(rawTitle.replace(/_/g, ' ')).trim();


    console.log(`[Repack Helper] Target game detected: "${targetGame}"`);

    const finalGameTitle = targetGame;

    if (!finalGameTitle) {
        console.warn('[Repack Helper] Failed to detect game name on the page.');
        return;
    }

    function normalizeTitle(str) {
        console.log(str);
        return str?.toLowerCase().replace(/’/g, "'") ?? "";
    }
   function getViableMatches(gameTitle) {
    console.log(`[Repack Helper] Searching for "${gameTitle}" on repack-games.com...`);
    return new Promise((resolve) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: `https://repack-games.com/?s=${encodeURIComponent(gameTitle)}`,
            onload: function(response) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, "text/html");
                const items = doc.querySelectorAll('ul.modern-articles.clean > li');

                console.log(`[Repack Helper] Found ${items.length} search results.`);

                const viableMatches = [];
                const minSimilarity = 0.2;

                items.forEach(li => {
                    const title = li.querySelector('div.content-list > a > h2')?.textContent.trim();
                    const href = li.querySelector('div.content-list > a')?.href;

                    if (title && href) {
                        // Check if the search term is present in the title (case-insensitive)


if (!normalizeTitle(title).includes(normalizeTitle(gameTitle))) {
  console.log(`[Repack Helper] Skipped: "${title}" — doesn't contain search term.`);
  return;
}


                        const similarity = calculateSimilarity(gameTitle, title);
                        console.log(`[Repack Helper] Checking match: "${title}" (similarity: ${similarity.toFixed(2)})`);

                        if (similarity >= minSimilarity) {
                            viableMatches.push({
                                title,
                                href,
                                similarity,
                                displayTitle: formatDisplayTitle(title, similarity)
                            });
                            console.log(`[Repack Helper] Added viable match: "${title}"`);
                        }
                    }
                });

                // Sort by similarity
                viableMatches.sort((a, b) => b.similarity - a.similarity);
                console.log(`[Repack Helper] Found ${viableMatches.length} viable matches.`);
                resolve(viableMatches);
            }
        });
    });
}


    function formatDisplayTitle(title, similarity) {
        // Add similarity score and clean up title for display
        const score = Math.round(similarity * 100);
        return `[${score}%] ${title}`;
    }

    function calculateSimilarity(a, b) {
        // Normalize both strings for better comparison
        const normalize = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const normA = normalize(a);
        const normB = normalize(b);

        const matrix = [];
        for (let i = 0; i <= normB.length; i++) matrix[i] = [i];
        for (let j = 0; j <= normA.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= normB.length; i++) {
            for (let j = 1; j <= normA.length; j++) {
                const cost = normA[j - 1] === normB[i - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }
        return 1 - (matrix[normB.length][normA.length] / Math.max(normA.length, normB.length));
    }

    function getDownloadLinks(gamePageUrl) {
        console.log(`[Repack Helper] Scraping download links from: ${gamePageUrl}`);
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: gamePageUrl,
                onload: function(response) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, "text/html");
                    const links = Array.from(doc.querySelectorAll('a.enjoy-css'))
                    .map(a => ({
                        host: new URL(a.href).hostname,
                               url: a.href
                    }));
                    console.log(`[Repack Helper] Found ${links.length} download links.`);
                    resolve(links);
                }
            });
        });
    }

async function createDownloadUI() {
    console.log('[Repack Helper] Initializing download UI...');
    const viableMatches = await getViableMatches(targetGame);
    const viableMatches2 = null;

    if (!viableMatches.length) {
       alert('No matching games found on repack-games.com');
        return;
    }

    const purchaseSection = document.querySelector('.game_area_purchase');
    if (!purchaseSection) {
        console.warn('[Repack Helper] Could not find purchase section on page.');
        return;
    }

    // Wipe all existing children
    while (purchaseSection.firstChild) {
        purchaseSection.removeChild(purchaseSection.firstChild);
    }

    const container = document.createElement('div');
    container.className = 'game_purchase_action';
    container.style.marginTop = '15px';

    const actionBg = document.createElement('div');
    actionBg.className = 'game_purchase_action_bg';
    actionBg.style.padding = '10px';

    const title = document.createElement('div');
    title.style.marginBottom = '10px';
    title.style.fontWeight = 'bold';
    title.style.color = '#b8b6b4';
    title.textContent = `${viableMatches.length} matches:`;

    const gameSelect = document.createElement('select');
    gameSelect.style.cssText = 'margin-bottom: 10px; width: 80%; padding: 8px; background-color: #3d4450; color: #c6d4df; border: 1px solid #495562; border-radius: 3px';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a game version...';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    gameSelect.appendChild(defaultOption);

    viableMatches.forEach(match => {
        const option = document.createElement('option');
        option.value = match.href;
        option.textContent = match.displayTitle;
        gameSelect.appendChild(option);
    });

    const downloadSelect = document.createElement('select');
    downloadSelect.style.cssText = 'margin-bottom: 28px; width: 50%; padding: 8px; background-color: #3d4450; color: #c6d4df; border: 1px solid #495562; border-radius: 3px; display: none';

    const loadingDiv = document.createElement('div');
    loadingDiv.style.cssText = 'display: none; text-align: center; color: #b8b6b4; margin: 10px 0';
    loadingDiv.textContent = 'Loading download links...';

    const buttonDiv = document.createElement('div');
    buttonDiv.className = 'btn_addtocart';
    buttonDiv.style.display = 'none';

    const button = document.createElement('a');
    button.className = 'btn_green_steamui btn_medium';
    button.target = '_blank';
    button.innerHTML = '<span>Direct Download</span>';
    button.onclick = (e) => {
        e.preventDefault();
        if (downloadSelect.value) {
            window.open(downloadSelect.value, '_blank');
            console.log(`[Repack Helper] Opening download: ${downloadSelect.value}`);
        }
    };

    const jdbutton = document.createElement('a');
    jdbutton.className = 'btn_green_steamui btn_medium';
    jdbutton.target = '_blank';
    jdbutton.innerHTML = '<span>Send to JDownloader</span>';
    jdbutton.onclick = (e) => {
        e.preventDefault();
        if (downloadSelect.value) {
            const selectedOption = gameSelect.options[gameSelect.selectedIndex];
            const packageName = selectedOption ? selectedOption.textContent : "Repack Game";

            const baseUrl = "http://127.0.0.1:3128/linkcollector/addLinksAndStartDownload?";
            const linksParam = "links=" + encodeURIComponent(downloadSelect.value);
            const packageParam = "&packageName=" + encodeURIComponent(packageName);
            const extraParams = "&extractPassword=&downloadPassword=";

            const fullLink = baseUrl + linksParam + packageParam + extraParams;
            window.open(fullLink, '_blank');
        }
    };

    buttonDiv.appendChild(button);
    buttonDiv.appendChild(jdbutton);

    gameSelect.onchange = async function () {
        if (!this.value) return;

        loadingDiv.style.display = 'block';
        downloadSelect.style.display = 'none';
        buttonDiv.style.display = 'none';

        try {
            const downloadLinks = await getDownloadLinks(this.value);
            downloadSelect.innerHTML = '';

            if (downloadLinks.length > 0) {
                downloadLinks.forEach(link => {
                    const option = document.createElement('option');
                    option.value = link.url;
                    option.textContent = `${link.host} - Download`;
                    downloadSelect.appendChild(option);
                });

                downloadSelect.style.display = 'block';
                buttonDiv.style.display = 'block';
                button.href = downloadLinks[0].url;

                console.log(`[Repack Helper] Loaded ${downloadLinks.length} download options`);
            } else {
                alert('No download links found for the selected game.');
            }
        } catch (error) {
            console.error('[Repack Helper] Error loading download links:', error);
            alert('Failed to load download links. Please try again.');
        }

        loadingDiv.style.display = 'none';
    };

    downloadSelect.onchange = function () {
        if (this.value) {
            button.href = this.value;
        }
    };

    actionBg.appendChild(title);
    actionBg.appendChild(gameSelect);
    actionBg.appendChild(loadingDiv);
    actionBg.appendChild(downloadSelect);
    actionBg.appendChild(buttonDiv);
    container.appendChild(actionBg);

    purchaseSection.appendChild(container);

    // Add margin-bottom to all children to prevent overlap
    Array.from(purchaseSection.children).forEach(child => {
        child.style.marginBottom = '40px';
    });

    console.log('[Repack Helper] UI inserted and old content wiped.');
}
createDownloadUI();


})();