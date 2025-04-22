// --- Configuration ---
const apiKey = '30e3b4873bdcdb6a0919087618456c1ea4f53b195541e8c7bf2821c7900b0cfc'; // API anahtarınızı buraya girin
const baseUrl = 'https://apiv3.apifootball.com/';
const leagues = [
    { id: '322', name: 'Türkiye - Süper Lig' },
    { id: '152', name: 'İngiltere - Premier League' },
    { id: '302', name: 'İspanya - La Liga' },
    { id: '207', name: 'İtalya - Serie A' },
    { id: '175', name: 'Almanya - Bundesliga' },
    { id: '168', name: 'Fransa - Ligue 1' }
    // Diğer ligleri ekleyebilirsiniz
];

// --- Güçlü Tahmin Eşikleri ---
const STRONG_CONFIDENCE_THRESHOLD_UPPER = 65; // Ev sahibi için güçlü tahmin sınırı (%65 ve üzeri)
const STRONG_CONFIDENCE_THRESHOLD_LOWER = 35; // Deplasman için güçlü tahmin sınırı (%35 ve altı)
const DRAW_CONFIDENCE_RANGE_LOW = 42;   // Beraberlik tahmini için alt güven skoru sınırı
const DRAW_CONFIDENCE_RANGE_HIGH = 58;  // Beraberlik tahmini için üst güven skoru sınırı
const DRAW_PROBABILITY_THRESHOLD = 12; // Beraberlik önermek için gereken minimum beraberlik puanı

// --- KG VAR/YOK Eşikleri ---
const KG_VAR_THRESHOLD = 1.35; // İki takımın beklenen gol toplamı bu değerin üzerindeyse KG Var daha olası
const KG_YOK_THRESHOLD = 0.9; // İki takımın beklenen gol toplamı bu değerin altındaysa KG Yok daha olası

// --- DOM Elements ---
const leagueSelect = document.getElementById('leagueSelect');
const navButtons = document.querySelectorAll('.nav-button');
const contentDivs = document.querySelectorAll('.data-view');
const analysisModal = document.getElementById('analysisModal');
const modalTitle = document.getElementById('modalTitle');
const modalLoading = document.getElementById('modalLoading');
const modalError = document.getElementById('modalError');
const modalAnalysisContent = document.getElementById('modalAnalysisContent');
const highlightsList = document.getElementById('highlightsList');
const clearHighlightsButton = document.getElementById('clearHighlightsButton');
const couponList = document.getElementById('couponList');
const clearCouponButton = document.getElementById('clearCouponButton');
const autoAnalysisStatusUpcoming = document.getElementById('autoAnalysisStatusUpcoming');
const analyzeUpcomingBtn = document.getElementById('analyzeUpcomingButton');
const apiStatusSpan = document.getElementById('apiStatus'); // API durumu için

// --- State ---
let selectedLeagueId = null;
let currentView = 'standings';
let currentStandingsData = null;
let currentTopScorersData = null;
let currentMatchDataForHighlight = null;
let currentMatchDataForCoupon = null;
let isAutoAnalyzing = false;
let apiCallCount = 0; // API çağrı sayacı
const API_CALL_LIMIT_WARNING = 80; // Uyarı sınırı (gerçek limit farklı olabilir)

// --- Helper Functions ---
function formatDate(d) { const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), a = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${a}`; }
function showLoading(viewId) { const v = document.getElementById(viewId); if (v) { const l = v.querySelector('.loading'); if (l) l.style.display = 'block'; const e = v.querySelector('.error'); if (e) e.style.display = 'none'; const tb = v.querySelector('tbody'); if (tb) tb.innerHTML = ''; const ml = v.querySelector('.match-list'); if (ml) ml.innerHTML = ''; } }
function hideLoading(viewId) { const v = document.getElementById(viewId); if (v) { const l = v.querySelector('.loading'); if (l) l.style.display = 'none'; } }
function showError(viewId, msg) { const v = document.getElementById(viewId); if (v) { const e = v.querySelector('.error'); if (e) { e.textContent = `Hata: ${msg || 'Bilinmeyen hata.'}`; e.style.display = 'block'; } } hideLoading(viewId); console.error(`Error ${viewId}:`, msg); }
function clearError(viewId) { const v = document.getElementById(viewId); if (v) { const e = v.querySelector('.error'); if (e) e.style.display = 'none'; } }
function showAutoAnalysisStatus(message, type = 'loading') { if (!autoAnalysisStatusUpcoming) return; autoAnalysisStatusUpcoming.textContent = message; autoAnalysisStatusUpcoming.className = `auto-analysis-status ${type}`; autoAnalysisStatusUpcoming.style.display = 'block'; }
function hideAutoAnalysisStatus() { if (autoAnalysisStatusUpcoming) autoAnalysisStatusUpcoming.style.display = 'none'; }
function updateApiStatus(status, message = '') {
    if (!apiStatusSpan) return;
    let color = '#6c757d'; // Default: Unknown/Gray
    let text = status;
    if (status === 'OK') { color = 'var(--success-color)'; text = `Aktif (${apiCallCount} çağrı)`; }
    else if (status === 'Limit Yakın') { color = 'var(--warning-color)'; text = `Limit Yakın (${apiCallCount} çağrı)`; }
    else if (status === 'Limit Aşıldı') { color = 'var(--danger-color)'; text = `Limit Aşıldı!`; }
    else if (status === 'Hata') { color = 'var(--danger-color)'; text = `API Hatası`; }
    apiStatusSpan.textContent = text + (message ? ` - ${message}` : '');
    apiStatusSpan.style.color = color;
    apiStatusSpan.style.fontWeight = (status !== 'OK') ? 'bold' : 'normal';
}

// --- View Güncelleme ---
function updateActiveView(viewId) {
    // ... (Mevcut kod - değişiklik yok) ...
    if (isAutoAnalyzing && viewId !== currentView) {
        showAutoAnalysisStatus("Toplu analiz devam ediyor. Lütfen tamamlanmasını bekleyin.", "loading");
        navButtons.forEach(b => b.classList.remove('active'));
        const currentActiveButton = document.querySelector(`.nav-button[data-view="${currentView}"]`);
        if(currentActiveButton) currentActiveButton.classList.add('active');
        return;
    }

    contentDivs.forEach(d => d.classList.remove('active'));
    navButtons.forEach(b => b.classList.remove('active'));

    const activeDiv = document.getElementById(viewId);
    const activeButton = document.querySelector(`.nav-button[data-view="${viewId}"]`);

    if (activeDiv) activeDiv.classList.add('active');
    if (activeButton) activeButton.classList.add('active');

    currentView = viewId;
    const dataContainer = activeDiv?.querySelector('tbody, .match-list');
    const needsLoading = !dataContainer || dataContainer.innerHTML.trim() === '';

    if (viewId !== 'upcoming') {
        hideAutoAnalysisStatus();
    }

    if (viewId === 'highlights') {
        displayHighlights();
    } else if (viewId === 'coupon') {
        displayCoupon();
    } else if (needsLoading && selectedLeagueId) {
        loadDataForView(viewId);
    } else if (needsLoading && !selectedLeagueId) {
        if (activeDiv && viewId !== 'highlights' && viewId !== 'coupon') {
           const listElement = activeDiv.querySelector('.match-list');
           const tableBody = activeDiv.querySelector('tbody');
           if (listElement) listElement.innerHTML = `<li>Lütfen lig seçin.</li>`;
           else if (tableBody && viewId === 'standings') tableBody.innerHTML = `<tr><td colspan="12">Lütfen lig seçin.</td></tr>`;
           else if (tableBody && viewId === 'topscorers') tableBody.innerHTML = `<tr><td colspan="5">Lütfen lig seçin.</td></tr>`;
           else if (tableBody) tableBody.innerHTML = `<tr><td colspan="10">Lütfen lig seçin.</td></tr>`;
        }
    }

    if (viewId === 'upcoming' && selectedLeagueId && analyzeUpcomingBtn) {
         analyzeUpcomingBtn.disabled = isAutoAnalyzing;
    } else if (viewId === 'upcoming' && analyzeUpcomingBtn) {
         analyzeUpcomingBtn.disabled = true;
    }
}

function openAnalysisModal() {
    modalAnalysisContent.innerHTML = '';
    const existingSuggestionSection = document.getElementById('suggestedBetSection');
    if (existingSuggestionSection) existingSuggestionSection.remove();
    const existingConfidenceSection = document.getElementById('confidenceScoreSection');
    if(existingConfidenceSection) existingConfidenceSection.remove();
    const existingGoalPredictionSection = document.getElementById('goalPredictionSection');
    if(existingGoalPredictionSection) existingGoalPredictionSection.remove();

    modalError.style.display = 'none';
    modalLoading.style.display = 'block';
    analysisModal.style.display = "block";
    currentMatchDataForHighlight = null;
    currentMatchDataForCoupon = null;
}
function closeAnalysisModal() { analysisModal.style.display = "none"; }
window.onclick = function(event) { if (event.target == analysisModal) { closeAnalysisModal(); } }

// --- API Fetching ---
async function fetchData(action, params = {}) {
    apiCallCount++;
    if (apiCallCount > API_CALL_LIMIT_WARNING * 1.1) { // Limitin biraz üzerinde kesin hata ver
         updateApiStatus('Limit Aşıldı');
         throw new Error("API limitine ulaşıldı veya aşıldı.");
    } else if (apiCallCount > API_CALL_LIMIT_WARNING) {
         updateApiStatus('Limit Yakın');
    } else {
         updateApiStatus('OK');
    }

    const urlParams = new URLSearchParams({ action, APIkey: apiKey, ...params });
    const url = `${baseUrl}?${urlParams.toString()}`;
    try {
        const response = await fetch(url);
        let responseData = null;
        try {
             const text = await response.text();
             if (!text) {
                 console.warn(`API Boş yanıt döndü: ${action}`, params);
                 updateApiStatus('Hata', `Boş yanıt (${action})`);
                 return action.startsWith('get_events') || action === 'get_H2H' ? [] : null;
             }
             responseData = JSON.parse(text);
        } catch (jsonError) {
             updateApiStatus('Hata', `JSON Parse (${action})`);
             if (response.headers.get('content-type')?.includes('text/html')) {
                 throw new Error(`API bir HTML hata sayfası döndü (status: ${response.status})`);
             }
             throw new Error(`API JSON parse hatası (status: ${response.status}): ${jsonError.message}`);
        }

        if (!response.ok) {
            let errorMsg = responseData?.message || `API Hatası (${response.status})`;
            if (errorMsg.toLowerCase().includes("limit") || errorMsg.toLowerCase().includes("exceeded") || response.status === 429) {
                 errorMsg = "API limitine ulaşıldı."; updateApiStatus('Limit Aşıldı');
            }
            else if (errorMsg.includes("not found") || errorMsg.includes("doesn't exist")) errorMsg = `Veri bulunamadı (${action}).`;
            else if (response.status === 404) errorMsg = `Kaynak bulunamadı (404 - ${action})`;
            else updateApiStatus('Hata', `API Status ${response.status} (${action})`);

            console.warn(`API Error (${response.status}) for ${action}: ${errorMsg}`, params);
            if (response.status === 404 || errorMsg.toLowerCase().includes("not found") || errorMsg.toLowerCase().includes("doesn't exist") || errorMsg.toLowerCase().includes("no ")) {
                return action.startsWith('get_events') || action === 'get_H2H' ? [] : null; // Veri yoksa boş array/null dön
            }
            throw new Error(errorMsg);
        }

        if (responseData.error && responseData.error != 0) {
             if (responseData.message && (responseData.message.toLowerCase().includes('no ') || responseData.message.toLowerCase().includes('not found') || responseData.message.toLowerCase().includes('doesn\'t exist'))) {
                 console.log(`${action}: API'den 'veri yok' mesajı alındı (error alanı ile).`);
                 return action.startsWith('get_events') || action === 'get_H2H' ? [] : null;
             }
              updateApiStatus('Hata', `API Bildirimi (${action})`);
             throw new Error(`API Bildirimi: ${responseData.message || 'Bilinmeyen API hatası'}`);
        }
         if (typeof responseData === 'object' && !Array.isArray(responseData) && Object.keys(responseData).length <= 2 && responseData?.message?.toLowerCase().includes('no ')) {
             console.log(`${action}: API'den 'veri yok' mesajı alındı (obje formatında).`);
             return action.startsWith('get_events') || action === 'get_H2H' ? [] : null;
         }

        return responseData;
    } catch (error) {
        console.error(`WorkspaceData Hatası (${action}):`, error);
         // API limit hatasını doğrudan yukarı fırlat
        if (error.message.toLowerCase().includes("limit")) {
            updateApiStatus('Limit Aşıldı');
            throw error; // Tekrar fırlat ki üst fonksiyonlar yakalasın
        }
        updateApiStatus('Hata', `Workspace/Network (${action})`);
        // Diğer hataları fetchError objesi olarak dön
        return { fetchError: true, message: error.message };
    }
}

// --- Specific Fetch Functions (Caching & Error Handling) ---
async function fetchStandings(leagueId) {
    if (currentStandingsData && Array.isArray(currentStandingsData) && currentStandingsData[0]?.league_id === leagueId) {
        return currentStandingsData;
    }
    const data = await fetchData('get_standings', { league_id: leagueId });
    if (data && !data.fetchError && Array.isArray(data) && data.length > 0) {
        currentStandingsData = data;
    } else {
         currentStandingsData = null; // Hata veya boş veri durumunda önbelleği temizle
         if(data?.fetchError && data.message.toLowerCase().includes("limit")) throw data; // Limit hatasını yukarı ilet
    }
    return data;
}

async function fetchTopScorers(leagueId) {
     if (currentTopScorersData && Array.isArray(currentTopScorersData) && currentTopScorersData[0]?.league_id === leagueId) {
        return currentTopScorersData;
    }
    const data = await fetchData('get_topscorers', { league_id: leagueId });
     if (data && !data.fetchError && Array.isArray(data) && data.length > 0) {
        currentTopScorersData = data;
    } else {
        currentTopScorersData = null;
        if(data?.fetchError && data.message.toLowerCase().includes("limit")) throw data;
    }
    return data;
}

async function fetchMatches(leagueId, from, to, teamId = null, status = null) {
    const params = { league_id: leagueId, from, to };
    if (teamId) params.team_id = teamId;
    if (status) params.match_status = status;
    const data = await fetchData('get_events', params);
    if(data?.fetchError && data.message.toLowerCase().includes("limit")) throw data;
    return data;
}

// --- Data Display Functions ---
function displayStandings(data) {
    // ... (Mevcut kod - değişiklik yok) ...
    const tableBody = document.getElementById('standingsTable').querySelector('tbody');
    tableBody.innerHTML = '';
    if (!data || data.fetchError || !Array.isArray(data) || data.length === 0) {
        const message = data?.fetchError ? data.message : 'Puan durumu verisi bulunamadı veya alınamadı.';
        showError('standings', message);
        tableBody.innerHTML = `<tr><td colspan="12">${message}</td></tr>`; // Colspan 12
        return;
    }
    clearError('standings');
    data.forEach(team => {
        const row = tableBody.insertRow();
        const badge = team.team_badge ? `<img src="${team.team_badge}" alt="${team.team_name}" class="team-badge">` : '';
        const formHtml = team.recent_form ? team.recent_form : "<span class='form-na'>N/A</span>"; // API'den geliyorsa kullan

        row.innerHTML = `
            <td>${team.overall_league_position}</td>
            <td>${badge}</td>
            <td>${team.team_name}</td>
            <td>${team.overall_league_payed}</td>
            <td>${team.overall_league_W}</td>
            <td>${team.overall_league_D}</td>
            <td>${team.overall_league_L}</td>
            <td>${team.overall_league_GF}</td>
            <td>${team.overall_league_GA}</td>
            <td>${team.overall_league_GD}</td>
            <td><strong>${team.overall_league_PTS}</strong></td>
            <td class="form-col"><span class="form-string">${formHtml}</span></td>
        `;
    });
}

function displayTopScorers(data) {
    // ... (Mevcut kod - değişiklik yok) ...
     const tableBody = document.getElementById('topscorersTable').querySelector('tbody');
    tableBody.innerHTML = '';
    if (!data || data.fetchError || !Array.isArray(data) || data.length === 0) {
        const message = data?.fetchError ? data.message : 'Gol krallığı bilgisi bulunamadı veya alınamadı.';
        showError('topscorers', message);
        tableBody.innerHTML = `<tr><td colspan="5">${message}</td></tr>`; // Colspan 5
        return;
    }
    clearError('topscorers');
    data.forEach(player => {
        const row = tableBody.insertRow();
        const badge = player.team_badge ? `<img src="${player.team_badge}" alt="${player.team_name}" class="team-badge">` : '';
        row.innerHTML = `
            <td>${player.player_place}</td>
            <td>${player.player_name}</td>
            <td>${badge}${player.team_name}</td>
            <td>${player.goals}</td>
            <td>${player.penalty_goals}</td>
        `;
    });
}

function displayMatches(listId, data, type) {
    // ... (Mevcut kod - küçük iyileştirmeler) ...
    const listElement = document.getElementById(listId);
    if (!listElement) return;
    listElement.innerHTML = '';

    if (!data || data.fetchError || !Array.isArray(data) || data.length === 0) {
        const message = data?.fetchError ? data.message : (type === 'recent' ? 'Son 7 güne ait maç bulunamadı.' : 'Gelecek 7 gün içinde maç bulunamadı.');
        listElement.innerHTML = `<li class="error-message">${message}</li>`; // Hata mesajı için class
        console.warn(`displayMatches (${type}): ${message}`);
        if (type === 'upcoming') showError('upcoming', message);
        else if (type === 'recent') showError('recent', message);
        return;
    }
     if (type === 'upcoming') clearError('upcoming');
     if (type === 'recent') clearError('recent');


    data.sort((a, b) => {
        const dateA = new Date(`${a.match_date} ${a.match_time || '00:00'}`);
        const dateB = new Date(`${b.match_date} ${b.match_time || '00:00'}`);
        return type === 'recent' ? dateB - dateA : dateA - dateB;
    });

    data.forEach(match => {
        const li = document.createElement('li');
        li.classList.add('match-item'); // List item için genel class
        const homeBadge = match.team_home_badge ? `<img src="${match.team_home_badge}" alt="${match.match_hometeam_name}" class="team-badge">` : '';
        const awayBadge = match.team_away_badge ? `<img src="${match.team_away_badge}" alt="${match.match_awayteam_name}" class="team-badge">` : '';

        let scoreOrTimeHtml;
        if (match.match_status === 'Finished') {
            scoreOrTimeHtml = `<span class="score">${match.match_hometeam_ft_score ?? match.match_hometeam_score} - ${match.match_awayteam_ft_score ?? match.match_awayteam_score}</span> <span class="status finished">(Bitti)</span>`;
        } else if (match.match_status === '' || !match.match_status || ['Postponed', 'Cancelled', 'Not Started', 'Time to be defined'].includes(match.match_status)) {
            scoreOrTimeHtml = `<span class="time">${match.match_time || 'TBD'}</span> <span class="status not-started">${match.match_status || 'Başlamadı'}</span>`;
        } else if (match.match_status?.includes(':')) { // Saat formatıysa
             scoreOrTimeHtml = `<span class="time">${match.match_time || match.match_status}</span> <span class="status not-started">Başlamadı</span>`;
        }
        else { // Canlı veya diğer durumlar
            scoreOrTimeHtml = `<span class="time live-score">${match.match_hometeam_score}-${match.match_awayteam_score}</span> <span class="status live">${match.match_status}</span>`;
        }

        let analysisButtonHtml = '';
        // Analiz butonu sadece gelecek ve henüz başlamamış maçlar için mantıklı
        if (type === 'upcoming' && match.match_id && match.league_id && match.match_hometeam_id && match.match_awayteam_id && match.match_hometeam_name && match.match_awayteam_name && (!match.match_status || ['Not Started', 'Time to be defined'].includes(match.match_status) || match.match_status?.includes(':')) ) {
            analysisButtonHtml = `<button class="analysis-button" data-match-id="${match.match_id}" data-league-id="${match.league_id}" data-home-id="${match.match_hometeam_id}" data-away-id="${match.match_awayteam_id}" data-home-name="${match.match_hometeam_name}" data-away-name="${match.match_awayteam_name}" data-match-date="${match.match_date}" onclick="fetchAndShowAnalysis(this)"><i class="fa-solid fa-magnifying-glass-chart"></i> Analiz Et</button>`;
        }

        li.innerHTML = `
            <div class="match-details">
                <span class="date">${match.match_date}</span>
                <div class="teams">${homeBadge}<span>${match.match_hometeam_name}</span> <span class="vs">vs</span> <span>${match.match_awayteam_name}</span>${awayBadge}</div>
                <div class="score-time">${scoreOrTimeHtml}</div>
            </div>
            ${analysisButtonHtml ? `<div class="match-actions">${analysisButtonHtml}</div>` : ''}
        `;
        listElement.appendChild(li);
    });
}

// --- Analysis Functions ---
function calculateFormString(teamId, matches, count = 5) {
    // ... (Mevcut kod - değişiklik yok, avgGoals zaten hesaplanıyor) ...
     if (!matches || matches.fetchError || !Array.isArray(matches) || matches.length === 0) {
        return { string: "<span class='form-na'>N/A</span>", points: 0, results: [], goalsScored: 0, goalsConceded: 0, matchesPlayed: 0, draws: 0, totalGoals: 0, avgGoals: 0, goalDiff: 0 };
    }

    let formString = '', points = 0, goalsScored = 0, goalsConceded = 0, draws = 0, totalGoals = 0;
    const results = []; // 'W', 'D', 'L'

    const relevantMatches = matches
        .filter(m => m.match_status === 'Finished' && (m.match_hometeam_id == teamId || m.match_awayteam_id == teamId))
        .sort((a, b) => new Date(`${b.match_date} ${b.match_time || '00:00'}`) - new Date(`${a.match_date} ${a.match_time || '00:00'}`))
        .slice(0, count);

    if (relevantMatches.length === 0) {
        return { string: "<span class='form-na'>N/A</span>", points: 0, results: [], goalsScored: 0, goalsConceded: 0, matchesPlayed: 0, draws: 0, totalGoals: 0, avgGoals: 0, goalDiff: 0 };
    }

    relevantMatches.forEach(match => { // En sondan başa doğru işlemeye gerek yok, sadece sonuçları alıyoruz
        const homeScore = parseInt(match.match_hometeam_ft_score ?? match.match_hometeam_score);
        const awayScore = parseInt(match.match_awayteam_ft_score ?? match.match_awayteam_score);
        let resultChar = '?', resultClass = 'na';

        if (!isNaN(homeScore) && !isNaN(awayScore)) {
            totalGoals += homeScore + awayScore;
            if (match.match_hometeam_id == teamId) {
                goalsScored += homeScore;
                goalsConceded += awayScore;
                if (homeScore > awayScore) { resultClass = 'W'; points += 3; resultChar = 'G'; }
                else if (homeScore === awayScore) { resultClass = 'D'; points += 1; resultChar = 'B'; draws++; }
                else { resultClass = 'L'; resultChar = 'M'; }
            } else { // Away team
                goalsScored += awayScore;
                goalsConceded += homeScore;
                 if (awayScore > homeScore) { resultClass = 'W'; points += 3; resultChar = 'G'; }
                else if (homeScore === awayScore) { resultClass = 'D'; points += 1; resultChar = 'B'; draws++; }
                else { resultClass = 'L'; resultChar = 'M'; }
            }
            results.push(resultClass);
             // Form stringini oluştururken reverse'e gerek yok, sonuçlar array'de doğru sırada
            formString = `<span class="form-${resultClass}" title="${match.match_date}: ${match.match_hometeam_name} ${homeScore}-${awayScore} ${match.match_awayteam_name}">${resultChar}</span>` + formString;
        } else {
            formString = `<span class="form-na" title="${match.match_date}: Skor Yok">?</span>` + formString;
            results.push('na');
        }
    });

    const avgGoals = relevantMatches.length > 0 ? totalGoals / relevantMatches.length : 0;
    const goalDiff = goalsScored - goalsConceded;

    return {
        string: formString || "<span class='form-na'>N/A</span>",
        points: points,
        results: results.reverse(), // Son maç en sonda olacak şekilde döndür
        goalsScored: goalsScored,
        goalsConceded: goalsConceded,
        matchesPlayed: relevantMatches.length,
        draws: draws,
        totalGoals: totalGoals,
        avgGoals: avgGoals,
        goalDiff: goalDiff // Son 5 maçtaki gol farkı
    };
}

// --- Geliştirilmiş Algoritmik Öneri Fonksiyonu ---
function determineSuggestedBet(analysisData) {
    const {
        predictions, h2hSummary, homeForm, awayForm,
        homeStanding, awayStanding, homeName, awayName
    } = analysisData;

    let confidenceScore = 50;
    let reasons = [];

    // Ağırlıklar (Toplam 1.0 olmalı)
    const STANDING_WEIGHT = 0.25; // Sıra, Puan, İç/Dış Performans PPG
    const FORM_WEIGHT = 0.30;     // Son 5 Maç Puan & Gol Farkı
    const GOAL_POTENTIAL_WEIGHT = 0.20; // Genel Atak/Defans Gücü (Season PPG) + H2H Gol Ort.
    const H2H_WEIGHT = 0.10;      // Head-to-Head Sonuçları (Kazanma Oranı Farkı)
    const API_WEIGHT = 0.15;      // API Tahmin Yüzdesi

    const SCALING_FACTOR = 50;

    // 1. Puan Durumu Faktörleri
    if (homeStanding && awayStanding && currentStandingsData && homeStanding.overall_league_payed > 0 && awayStanding.overall_league_payed > 0) {
        const totalTeams = currentStandingsData.length || 20;
        const homePlayed = parseInt(homeStanding.overall_league_payed);
        const awayPlayed = parseInt(awayStanding.overall_league_payed);

        // a) Sıralama Farkı (Normalize edilmiş)
        const rankDiff = parseInt(awayStanding.overall_league_position) - parseInt(homeStanding.overall_league_position);
        const rankScoreEffect = (rankDiff / totalTeams) * SCALING_FACTOR * STANDING_WEIGHT * 0.3; // %30 etki
        confidenceScore += rankScoreEffect;
        if (Math.abs(rankDiff) >= Math.max(4, totalTeams * 0.1)) { // %10 veya 4 sıra fark
            reasons.push(`Sıra Farkı (${rankDiff > 0 ? homeName : awayName} ${Math.abs(rankDiff)} sıra üstte)`);
        }

        // b) Maç Başı Puan Farkı (Normalize edilmiş)
        const homePPG = parseInt(homeStanding.overall_league_PTS) / homePlayed;
        const awayPPG = parseInt(awayStanding.overall_league_PTS) / awayPlayed;
        const ppgDiff = homePPG - awayPPG; // Max fark ~3
        const pointScoreEffect = (ppgDiff / 3) * SCALING_FACTOR * STANDING_WEIGHT * 0.3; // %30 etki
        confidenceScore += pointScoreEffect;
         if (Math.abs(ppgDiff) > 0.5) { // Maç başı yarım puandan fazla fark varsa
             reasons.push(`Puan Ort. Farkı (${ppgDiff > 0 ? '+' : ''}${ppgDiff.toFixed(2)} ${homeName} lehine)`);
         }

         // c) Özel İç/Dış Saha PPG Farkı (Varsa)
         if (homeStanding.home_league_payed && awayStanding.away_league_payed &&
             parseInt(homeStanding.home_league_payed) >= 3 && parseInt(awayStanding.away_league_payed) >= 3) {
            const homePtsPerGameHome = (parseInt(homeStanding.home_league_W) * 3 + parseInt(homeStanding.home_league_D)) / parseInt(homeStanding.home_league_payed);
            const awayPtsPerGameAway = (parseInt(awayStanding.away_league_W) * 3 + parseInt(awayStanding.away_league_D)) / parseInt(awayStanding.away_league_payed);
            const specificPerfDiff = homePtsPerGameHome - awayPtsPerGameAway; // Max fark 3
            const specificPerfEffect = (specificPerfDiff / 3) * SCALING_FACTOR * STANDING_WEIGHT * 0.4; // %40 etki
            confidenceScore += specificPerfEffect;
             if (Math.abs(specificPerfDiff) > 0.7) {
                reasons.push(`İç/Dış PPG Farkı (${specificPerfDiff > 0 ? 'Ev Avantajı' : 'Dep Avantajı'} ${specificPerfDiff.toFixed(2)})`);
            }
        }
    } else {
        reasons.push("Puan durumu verisi eksik/yetersiz");
    }

    // 2. Son 5 Maç Formu
    if (homeForm && awayForm && homeForm.matchesPlayed >= 3 && awayForm.matchesPlayed >= 3) {
        // a) Puan Farkı (Son 5 Maç)
        const formPointDiff = homeForm.points - awayForm.points; // Max 15
        const formPointEffect = (formPointDiff / 15) * SCALING_FACTOR * FORM_WEIGHT * 0.6; // %60 etki
        confidenceScore += formPointEffect;
        if (Math.abs(formPointDiff) >= 5) { // 5 puan farkı (örn: 1G 2B vs 1B 2M)
             reasons.push(`Form Puanı Farkı (${formPointDiff > 0 ? homeName : awayName} +${Math.abs(formPointDiff)})`);
        }

        // b) Gol Farkı (Son 5 Maç)
        const formGoalDiffOverall = homeForm.goalDiff - awayForm.goalDiff;
        const formGoalEffect = Math.max(-1, Math.min(1, formGoalDiffOverall / 7)) * SCALING_FACTOR * FORM_WEIGHT * 0.4; // %40 etki, +/-7 ile normalize et
        confidenceScore += formGoalEffect;
         if (Math.abs(formGoalDiffOverall) >= 3) {
             reasons.push(`Form Gol Farkı (Ev ${homeForm.goalDiff > 0 ? '+' : ''}${homeForm.goalDiff} / Dep ${awayForm.goalDiff > 0 ? '+' : ''}${awayForm.goalDiff})`);
        }
    } else {
        reasons.push("Son 5 maç form verisi yetersiz");
    }

    // 3. Genel Gol Potansiyeli / Yeme Riski
    if (homeStanding && awayStanding && homeStanding.overall_league_payed >= 5 && awayStanding.overall_league_payed >= 5) {
        const homePlayed = parseInt(homeStanding.overall_league_payed);
        const awayPlayed = parseInt(awayStanding.overall_league_payed);
        const homeAttackStrength = parseInt(homeStanding.overall_league_GF) / homePlayed;
        const awayAttackStrength = parseInt(awayStanding.overall_league_GF) / awayPlayed;
        const homeDefenseWeakness = parseInt(homeStanding.overall_league_GA) / homePlayed;
        const awayDefenseWeakness = parseInt(awayStanding.overall_league_GA) / awayPlayed;

        // Ev sahibi atak vs deplasman defans & Deplasman atak vs ev sahibi defans farkı
        const goalRateDiff = (homeAttackStrength - awayDefenseWeakness) - (awayAttackStrength - homeDefenseWeakness);
        const goalRateEffect = Math.max(-1, Math.min(1, goalRateDiff / 1.2)) * SCALING_FACTOR * GOAL_POTENTIAL_WEIGHT * 0.7; // %70 etki, /1.2 ile normalize
        confidenceScore += goalRateEffect;

        if (Math.abs(goalRateDiff) > 0.4) {
             reasons.push(`Genel Atak/Defans Farkı (${goalRateDiff > 0 ? homeName : awayName} ${goalRateDiff > 0 ? '+' : ''}${goalRateDiff.toFixed(2)})`);
        }
    } else {
         reasons.push("Genel gol potansiyeli için yeterli maç yok");
    }
     // H2H Gol Ortalaması Etkisi
     if (h2hSummary && h2hSummary.total >=3 && h2hSummary.avgGoals) {
        const h2hGoalEffect = (h2hSummary.avgGoals - 2.5) * 0.1 * SCALING_FACTOR * GOAL_POTENTIAL_WEIGHT * 0.3; // %30 etki, 2.5 ort. kabulü, 0.1 çarpanı
        // Bu etki direkt skora eklenmez, beraberlik olasılığını etkileyebilir veya gol tahmininde kullanılır.
        // Şimdilik sadece 'reasons' a ekleyelim
        if (h2hSummary.avgGoals > 3.0) reasons.push("H2H Genellikle Gollü");
        else if (h2hSummary.avgGoals < 2.0) reasons.push("H2H Genellikle Az Gollü");
    }


    // 4. Head-to-Head (H2H) Sonuçları
    let h2hDrawRate = 0;
    if (h2hSummary && h2hSummary.total >= 3) {
        const homeWinRate = h2hSummary.homeWins / h2hSummary.total;
        const awayWinRate = h2hSummary.awayWins / h2hSummary.total;
        h2hDrawRate = h2hSummary.draws / h2hSummary.total;
        const h2hDiff = homeWinRate - awayWinRate; // -1 ile 1 arası
        const h2hEffect = h2hDiff * SCALING_FACTOR * H2H_WEIGHT; // H2H ağırlığı daha düşük
        confidenceScore += h2hEffect;
         if (Math.abs(h2hDiff) > 0.30) { // %30 fark
            reasons.push(`H2H Sonuç Üstünlüğü (${h2hDiff > 0 ? homeName : awayName} +%${(Math.abs(h2hDiff)*100).toFixed(0)})`);
        }
    }

    // 5. API Tahminleri
    let apiDrawPercent = 0;
    let apiSuggestionLeansHome = null; // null: belirsiz, true: ev, false: dep
    if (predictions?.percent?.home && predictions.percent.away) {
        const apiHome = parseFloat(predictions.percent.home.replace('%', '')) || 0;
        apiDrawPercent = parseFloat(predictions.percent.draw?.replace('%', '')) || 0;
        const apiAway = parseFloat(predictions.percent.away.replace('%', '')) || 0;
        const apiDiff = apiHome - apiAway;
        const apiEffect = (apiDiff / 100) * SCALING_FACTOR * API_WEIGHT;
        confidenceScore += apiEffect;

        if (apiHome > apiAway + 10) apiSuggestionLeansHome = true;
        else if (apiAway > apiHome + 10) apiSuggestionLeansHome = false;

        if (Math.abs(apiDiff) > 20) {
            reasons.push(`API Farkı (${apiDiff > 0 ? homeName : awayName} +%${Math.abs(apiDiff).toFixed(0)})`);
        }
    } else {
         reasons.push("API Tahmini verisi eksik");
    }

    // --- Beraberlik Olasılığı Puanı ---
    let drawProbabilityScore = 0;
    if (apiDrawPercent > 28) drawProbabilityScore += (apiDrawPercent - 28) * 0.4; // %28 üzeri
    if (homeForm && awayForm && homeForm.matchesPlayed > 0 && awayForm.matchesPlayed > 0) {
       const avgDrawsLast5 = (homeForm.draws / homeForm.matchesPlayed + awayForm.draws / awayForm.matchesPlayed) / 2;
       if (avgDrawsLast5 >= 0.25) drawProbabilityScore += (avgDrawsLast5 * 100 - 25) * 0.3; // Ort %25 üzeri
    }
    if (h2hDrawRate > 0.28) drawProbabilityScore += (h2hDrawRate * 100 - 28) * 0.3; // H2H %28 üzeri
    // Düşük skorlu maç beklentisi beraberliği artırabilir (Goal Prediction'dan alınabilir ama döngüsel bağımlılık yaratır)

    // Skoru 0-100 arasına sabitle
    confidenceScore = Math.max(0, Math.min(100, confidenceScore));

    // --- Final Karar ---
    let suggestion = "Belirsiz / Riskli";
    let cssClass = "suggestion-neutral";
    let isStrong = false;

    if (confidenceScore >= STRONG_CONFIDENCE_THRESHOLD_UPPER) {
        suggestion = `Ev Sahibi Kazanır (1)`; cssClass = "suggestion-home"; isStrong = true;
        if(apiSuggestionLeansHome === false) reasons.push("API TAHMİNİ İLE UYUŞMAZ!"); // API farklı düşünüyorsa uyar
    } else if (confidenceScore <= STRONG_CONFIDENCE_THRESHOLD_LOWER) {
        suggestion = `Deplasman Kazanır (2)`; cssClass = "suggestion-away"; isStrong = true;
         if(apiSuggestionLeansHome === true) reasons.push("API TAHMİNİ İLE UYUŞMAZ!"); // API farklı düşünüyorsa uyar
    } else {
        // Orta bölge
        if (confidenceScore >= DRAW_CONFIDENCE_RANGE_LOW && confidenceScore <= DRAW_CONFIDENCE_RANGE_HIGH && drawProbabilityScore >= DRAW_PROBABILITY_THRESHOLD) {
            suggestion = "Beraberlik (X)"; cssClass = "suggestion-draw";
            reasons.push(`Yüksek Beraberlik Puanı (${drawProbabilityScore.toFixed(0)})`);
        } else if (confidenceScore > 55) { // Hafif ev sahibi eğilimi
             suggestion = "Ev Sahibi Daha Yakın / Riskli (1?)"; cssClass = "suggestion-home";
             if(apiSuggestionLeansHome === false) reasons.push("API tersini işaret ediyor.");
        } else if (confidenceScore < 45) { // Hafif deplasman eğilimi
             suggestion = "Deplasman Daha Yakın / Riskli (2?)"; cssClass = "suggestion-away";
             if(apiSuggestionLeansHome === true) reasons.push("API tersini işaret ediyor.");
        } else { // Ortada (45-55 arası ve beraberlik puanı düşükse)
            suggestion = "Çok Belirsiz / Riskli"; cssClass = "suggestion-neutral";
             if (drawProbabilityScore >= DRAW_PROBABILITY_THRESHOLD * 0.75) { // Beraberlik puanı sınıra yakınsa
                 reasons.push(`Hafif Beraberlik Eğilimi (Puan: ${drawProbabilityScore.toFixed(0)})`);
             }
        }
    }

    // En önemli nedenleri seç (Örn: En büyük etkiye sahip ilk 3 faktör veya uyarılar)
     const finalReason = reasons.length > 0
        ? reasons.slice(0, 4).join(' | ') // Max 4 neden göster
        : "Belirgin bir faktör ayrıştırılamadı.";

    return { suggestion, reason: finalReason, cssClass, confidenceScore, isStrong };
}


// --- YENİ: Geliştirilmiş Toplam Gol Sayısı Tahmin Fonksiyonu ---
function predictTotalGoals(analysisData) {
    const { h2hSummary, homeForm, awayForm, homeStanding, awayStanding } = analysisData;

    let estimatedGoals = 2.5; // Varsayılan
    let homeExpectedGoals = 1.25; // Varsayılan
    let awayExpectedGoals = 1.25; // Varsayılan
    let factorsCount = 0;
    let totalWeight = 0;
    let weightedSum = 0;

    // Ağırlıklar
    const SEASON_AVG_WEIGHT = 0.20;
    const SEASON_ATK_DEF_WEIGHT = 0.30; // Takım Atak/Defans vs Rakip Defans/Atak
    const RECENT_FORM_WEIGHT = 0.30;
    const H2H_WEIGHT = 0.20;

    let homeAttack = 1.0, awayAttack = 1.0, homeDefense = 1.0, awayDefense = 1.0; // Ortalama 1.0 kabul edelim

    // 1. Sezon Geneli Atak/Defans Güçleri (Maç Başı Gol)
    if (homeStanding && awayStanding && homeStanding.overall_league_payed >= 5 && awayStanding.overall_league_payed >= 5) {
        const homePlayed = parseInt(homeStanding.overall_league_payed);
        const awayPlayed = parseInt(awayStanding.overall_league_payed);
        homeAttack = parseInt(homeStanding.overall_league_GF) / homePlayed;
        awayAttack = parseInt(awayStanding.overall_league_GF) / awayPlayed;
        homeDefense = parseInt(homeStanding.overall_league_GA) / homePlayed; // Düşük = İyi Defans
        awayDefense = parseInt(awayStanding.overall_league_GA) / awayPlayed;

        // Genel Ortalama Gol (Ağırlıklı Ortalamaya Katkı)
        const seasonAvgTotal = (homeAttack + homeDefense + awayAttack + awayDefense) / 2;
        weightedSum += seasonAvgTotal * SEASON_AVG_WEIGHT;
        totalWeight += SEASON_AVG_WEIGHT;
        factorsCount++;

        // Takım Özel Beklenen Goller (Atak gücü * Rakip Defans zayıflığı - basit model)
        // Lig ortalaması ile normalize etmek daha iyi olurdu, şimdilik direk kullanalım
        homeExpectedGoals = homeAttack * (awayDefense / ((homeDefense+awayDefense)/2 || 1)); // Ev atak * (Dep defans / Ort Defans)
        awayExpectedGoals = awayAttack * (homeDefense / ((homeDefense+awayDefense)/2 || 1)); // Dep atak * (Ev defans / Ort Defans)

        // Bu beklenen golleri de ağırlıklı ortalamaya katalım
        weightedSum += (homeExpectedGoals + awayExpectedGoals) * SEASON_ATK_DEF_WEIGHT;
        totalWeight += SEASON_ATK_DEF_WEIGHT;
        factorsCount++;

         // console.log(`Season Stats: H_Atk:${homeAttack.toFixed(2)}, H_Def:${homeDefense.toFixed(2)}, A_Atk:${awayAttack.toFixed(2)}, A_Def:${awayDefense.toFixed(2)}`);
         // console.log(`Expected Goals (Season): H:${homeExpectedGoals.toFixed(2)}, A:${awayExpectedGoals.toFixed(2)}`);

    }

    // 2. İç Saha / Dış Saha Özel Gol Ortalamaları (Varsa ve Sezon genelinden farklıysa)
    if (homeStanding?.home_league_payed >= 3 && awayStanding?.away_league_payed >= 3) {
         // Bu kısım `determineSuggestedBet` içinde zaten var, tekrar hesaplamaya gerek yok.
         // Ancak modal içinde gösterilebilir.
    }

    // 3. Son 5 Maç Gol Ortalaması
    let recentAvg = 2.5; // Varsayılan
    if (homeForm?.matchesPlayed >= 3 && awayForm?.matchesPlayed >= 3) {
        recentAvg = (homeForm.avgGoals + awayForm.avgGoals) / 2;
        weightedSum += recentAvg * RECENT_FORM_WEIGHT;
        totalWeight += RECENT_FORM_WEIGHT;
        factorsCount++;
        // console.log("Goal Prediction - Recent Avg:", recentAvg.toFixed(2));
    }

    // 4. H2H Maçları Ortalama Gol
    let h2hAvg = 2.5; // Varsayılan
    if (h2hSummary?.total >= 3) {
        h2hAvg = h2hSummary.avgGoals;
        weightedSum += h2hAvg * H2H_WEIGHT;
        totalWeight += H2H_WEIGHT;
        factorsCount++;
        // console.log("Goal Prediction - H2H Avg:", h2hAvg.toFixed(2));
    }

    // Ağırlıklı Toplam Gol Ortalaması
    if (totalWeight > 0) {
        estimatedGoals = weightedSum / totalWeight;
    } else if (factorsCount > 0) {
        estimatedGoals = weightedSum / factorsCount; // Basit ortalama
    }
    // console.log("Goal Prediction - Final Estimated Total:", estimatedGoals.toFixed(2));


    // --- Metin Tahminleri ---
    let predictionText = "";
    let overUnder25 = "";
    let kgVarYok = "KG Var/Yok Belirsiz";
    const overUnderThreshold = 2.5;

    // Alt/Üst Tahmini
    const probabilityOver = Math.max(0, Math.min(100, 50 + (estimatedGoals - overUnderThreshold) * 35));
    if (estimatedGoals < 2.0) { predictionText = "Çok düşük skorlu (0-1 gol) bir maç bekleniyor."; }
    else if (estimatedGoals < 2.4) { predictionText = "Az skorlu (2 gol civarı) bir maç olabilir."; }
    else if (estimatedGoals < 2.8) { predictionText = `Ortalama skorlu (${Math.round(estimatedGoals)} gol civarı) bir maç bekleniyor.`; }
    else if (estimatedGoals < 3.3) { predictionText = `Gollü geçmeye aday (${Math.round(estimatedGoals)} gol civarı).`; }
    else { predictionText = `Yüksek skorlu (${Math.ceil(estimatedGoals)}+ gol) bir maç potansiyeli var.`; }

    if (probabilityOver > 60) { overUnder25 = `Üst ${overUnderThreshold} (%${probabilityOver.toFixed(0)})`; }
    else if (probabilityOver < 40) { overUnder25 = `Alt ${overUnderThreshold} (%${(100 - probabilityOver).toFixed(0)})`; }
    else { overUnder25 = `${overUnderThreshold} Alt/Üst Dengeli`; }

    // KG Var/Yok Tahmini (Basit Model: Beklenen gollerin toplamına göre)
    const expectedTotal = homeExpectedGoals + awayExpectedGoals;
    const probKgVar = Math.max(0, Math.min(100, 50 + (expectedTotal - (KG_VAR_THRESHOLD + KG_YOK_THRESHOLD)/2) * 40)); // Ortalamaya göre olasılık

    if (expectedTotal > KG_VAR_THRESHOLD && probKgVar > 55) {
        kgVarYok = `KG Var Olası (%${probKgVar.toFixed(0)})`;
    } else if (expectedTotal < KG_YOK_THRESHOLD && probKgVar < 45) {
        kgVarYok = `KG Yok Olası (%${(100 - probKgVar).toFixed(0)})`;
    } else {
        kgVarYok = `KG Var/Yok Dengeli`;
    }


    return {
        estimatedTotalGoals: estimatedGoals.toFixed(2),
        predictionText: predictionText,
        overUnder25: overUnder25,
        kgVarYok: kgVarYok,
        homeExpectedGoals: homeExpectedGoals.toFixed(2),
        awayExpectedGoals: awayExpectedGoals.toFixed(2)
    };
}


// --- Analiz Verilerini Getirme (Tek Maç İçin) ---
async function getAnalysisDataForMatch(match) {
    // ... (Mevcut kod - Temelde aynı, Promise.allSettled ile hata yönetimi önemli) ...
    console.log(`${match.match_hometeam_name} vs ${match.match_awayteam_name} için analiz verisi çekiliyor...`);
    const homeId = match.match_hometeam_id;
    const awayId = match.match_awayteam_id;
    const leagueId = match.league_id;
    const matchId = match.match_id;

    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 90); // Son 90 gün form
    const fromDateStr = formatDate(pastDate);
    const toDateStr = formatDate(today);

    const results = await Promise.allSettled([
        fetchData('get_H2H', { firstTeamId: homeId, secondTeamId: awayId }), // 0
        fetchData('get_events', { league_id: leagueId, from: fromDateStr, to: toDateStr, team_id: homeId, match_status: 'Finished' }), // 1
        fetchData('get_events', { league_id: leagueId, from: fromDateStr, to: toDateStr, team_id: awayId, match_status: 'Finished' }), // 2
        fetchStandings(leagueId), // 3 (Cached)
        fetchData('get_predictions', { match_id: matchId }) // 4
    ]);

    const getResult = (index, isArrayExpected = false) => {
        const result = results[index];
        if (result.status === 'rejected') {
            console.warn(`Analiz verisi alınamadı (Rejected ${index}): ${result.reason?.message || result.reason}`);
            // Limit hatasını tekrar fırlat
            if(result.reason?.message?.toLowerCase().includes("limit")) throw result.reason;
            return isArrayExpected ? [] : null;
        }
        if (result.value?.fetchError) {
            console.warn(`Analiz verisi alınamadı (Fetch Error ${index}): ${result.value.message}`);
            // Limit hatasını tekrar fırlat
             if(result.value.message?.toLowerCase().includes("limit")) throw result.value;
            return isArrayExpected ? [] : null;
        }
        // API'den 'veri yok' ([], null veya özel mesaj) durumları
        if (result.value === null || (Array.isArray(result.value) && result.value.length === 0)) {
            return isArrayExpected ? [] : null;
        }
         // API bazen { "message": "No ..." } dönebilir
         if (typeof result.value === 'object' && !Array.isArray(result.value) && Object.keys(result.value).length <= 2 && result.value.message?.toLowerCase().includes('no ')) {
             return isArrayExpected ? [] : null;
         }

        return result.value;
    };

    // Hata fırlatma olasılığı olanları try-catch içine al
     let h2hData, homeMatchesData, awayMatchesData, standingsData, predictionsData;
     try {
         h2hData = getResult(0, true); // Array bekliyoruz
         homeMatchesData = getResult(1, true); // Array bekliyoruz
         awayMatchesData = getResult(2, true); // Array bekliyoruz
         standingsData = getResult(3, true); // Array bekliyoruz (fetchStandings'den)
         predictionsData = getResult(4); // Obje/Array olabilir
     } catch (error) {
         // Eğer limit hatası ise, analizi durdur ve hatayı yukarı fırlat
         if (error.message?.toLowerCase().includes("limit")) {
             console.error("API Limit Hatası nedeniyle analiz durduruldu.");
             throw error; // Bu hatayı çağıran fonksiyona (örn: analyzeUpcomingAndAddToCoupon) ilet
         }
         // Diğer fetch hataları için null/boş array dönecek, analiz eksik veriyle devam edebilir.
         console.error("Veri çekme sırasında yakalanan hata:", error);
         // Eksik kalanları null/boş array yap
         h2hData = h2hData ?? [];
         homeMatchesData = homeMatchesData ?? [];
         awayMatchesData = awayMatchesData ?? [];
         standingsData = standingsData ?? [];
         predictionsData = predictionsData ?? null;
     }


    let analysisInput = {
        homeName: match.match_hometeam_name, awayName: match.match_awayteam_name,
        predictions: null, h2hSummary: null, homeForm: null, awayForm: null,
        homeStanding: null, awayStanding: null,
        fetchError: null // Genel bir hata durumu ekleyelim
    };

    // Check if any critical fetch failed
    if (results.some(r => r.status === 'rejected' || r.value?.fetchError)) {
        analysisInput.fetchError = "Bazı analiz verileri alınamadı.";
    }


    if (predictionsData && Array.isArray(predictionsData) && predictionsData.length > 0) {
        analysisInput.predictions = predictionsData[0].predictions || predictionsData[0]; // API bazen direkt objeyi döner
    } else if (predictionsData && typeof predictionsData === 'object' && predictionsData.predictions) {
         analysisInput.predictions = predictionsData.predictions; // Direkt obje durumu
    } else if (predictionsData && typeof predictionsData === 'object' && !predictionsData.message) { // İç içe olmayan yapı
        analysisInput.predictions = predictionsData;
    }


    if (h2hData && Array.isArray(h2hData) && h2hData.length > 0) {
        let summary = { homeWins: 0, awayWins: 0, draws: 0, totalGoals: 0, total: 0, avgGoals: 0 };
        h2hData.forEach(m => {
            const hs = parseInt(m.match_hometeam_ft_score ?? m.match_hometeam_score);
            const as = parseInt(m.match_awayteam_ft_score ?? m.match_awayteam_score);
            if (!isNaN(hs) && !isNaN(as)) {
                summary.totalGoals += hs + as;
                 if (m.match_hometeam_id == homeId) {
                    if (hs > as) summary.homeWins++; else if (as > hs) summary.awayWins++; else summary.draws++;
                } else if (m.match_awayteam_id == homeId) { // Eğer ev sahibi deplasmandaysa
                     if (as > hs) summary.homeWins++; else if (hs > as) summary.awayWins++; else summary.draws++;
                } else { // Takımlar eşleşmiyorsa (nadir), sadece beraberliğe bak
                    if (hs === as) summary.draws++;
                }
                 summary.total++;
            }
        });
        if (summary.total > 0) {
            summary.avgGoals = summary.totalGoals / summary.total;
        }
        analysisInput.h2hSummary = summary;
    }

    if (homeMatchesData) analysisInput.homeForm = calculateFormString(homeId, homeMatchesData);
    if (awayMatchesData) analysisInput.awayForm = calculateFormString(awayId, awayMatchesData);

    if (standingsData && Array.isArray(standingsData) && standingsData.length > 0) {
        analysisInput.homeStanding = standingsData.find(t => t.team_id == homeId) || null;
        analysisInput.awayStanding = standingsData.find(t => t.team_id == awayId) || null;
        // Standings verisine direkt PPG ekleyelim (opsiyonel, burada veya kullanırken hesaplanabilir)
        // if(analysisInput.homeStanding) analysisInput.homeStanding.ppg = analysisInput.homeStanding.overall_league_PTS / analysisInput.homeStanding.overall_league_payed;
        // if(analysisInput.awayStanding) analysisInput.awayStanding.ppg = analysisInput.awayStanding.overall_league_PTS / analysisInput.awayStanding.overall_league_payed;
    }

    return analysisInput;
}


// --- Manuel Analiz (Modal İçin) ---
async function fetchAndShowAnalysis(buttonElement) {
    // ... (Mevcut kod - Temelde aynı, Promise.allSettled ve getResult kullanımı) ...
    const matchId = buttonElement.dataset.matchId;
    const leagueId = buttonElement.dataset.leagueId;
    const homeId = buttonElement.dataset.homeId;
    const awayId = buttonElement.dataset.awayId;
    const homeName = buttonElement.dataset.homeName;
    const awayName = buttonElement.dataset.awayName;
    const matchDate = buttonElement.dataset.matchDate;

    const baseMatchData = { matchId, leagueId, homeId, awayId, homeName, awayName, matchDate };

    currentMatchDataForHighlight = { ...baseMatchData, suggestion: null, confidenceScore: null, reason: null, goalPrediction: null, kgVarYok: null };
    currentMatchDataForCoupon = null;

    modalTitle.textContent = `${homeName} vs ${awayName} - Analiz`;
    openAnalysisModal();

    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 90);
    const fromDateStr = formatDate(pastDate);
    const toDateStr = formatDate(today);

    const results = await Promise.allSettled([
        fetchData('get_H2H', { firstTeamId: homeId, secondTeamId: awayId }), // 0
        fetchData('get_events', { league_id: leagueId, from: fromDateStr, to: toDateStr, team_id: homeId, match_status: 'Finished' }), // 1
        fetchData('get_events', { league_id: leagueId, from: fromDateStr, to: toDateStr, team_id: awayId, match_status: 'Finished' }), // 2
        fetchStandings(leagueId),   // 3 (Cached)
        fetchData('get_odds', { match_id: matchId }), // 4
        fetchTopScorers(leagueId),  // 5 (Cached)
        fetchData('get_predictions', { match_id: matchId }) // 6
    ]);

    modalLoading.style.display = 'none';
    displayAnalysisDataInModal(results, baseMatchData); // Verileri ve temel maç bilgisini gönder
}


// --- Analiz Sonuçlarını Modal'da Gösterme (Geliştirilmiş) ---
function displayAnalysisDataInModal(results, baseMatchData) {
    modalAnalysisContent.innerHTML = '';
    let overallError = null;

    const getResult = (index, isArrayExpected = false) => {
        const result = results[index];
        if (result.status === 'rejected' || (result.status === 'fulfilled' && result.value?.fetchError)) {
            const errorMessage = result.reason?.message || result.value?.message || `Veri alınamadı (${index})`;
            console.warn(`Modal Analiz Hata ${index}:`, errorMessage);
             if (errorMessage.toLowerCase().includes("limit")) {
                overallError = "API Limiti Aşıldı!"; // Limit hatasını her zaman göster
             } else if (!errorMessage.toLowerCase().includes('bulunamadı') && /* ...diğer non-kritik mesajlar... */ !overallError) {
                overallError = errorMessage; // İlk kritik olmayan hatayı sakla
             }
            return isArrayExpected ? [] : null;
        }
        // API'den 'veri yok' durumları
        if (result.status === 'fulfilled' && (result.value === null || (Array.isArray(result.value) && result.value.length === 0))) {
            return isArrayExpected ? [] : null;
        }
         // API bazen { "message": "No ..." } dönebilir
        if (result.status === 'fulfilled' && typeof result.value === 'object' && !Array.isArray(result.value) && Object.keys(result.value).length <= 2 && result.value.message?.toLowerCase().includes('no ')) {
             return isArrayExpected ? [] : null;
        }
        return result.value;
    };

    // Verileri Al
    const h2hData = getResult(0, true);
    const homeMatchesData = getResult(1, true);
    const awayMatchesData = getResult(2, true);
    const standingsData = getResult(3, true); // fetchStandings'den array gelir
    const oddsData = getResult(4); // Array veya obje olabilir
    const topScorersData = getResult(5, true); // fetchTopScorers'den array gelir
    const predictionsData = getResult(6); // Array veya obje olabilir

    // --- Algoritma için veri toplama ---
    // (getAnalysisDataForMatch fonksiyonuna benzer şekilde, ama burada tekrar yapıyoruz ki modal bağımsız olsun)
    let analysisForAlgorithm = {
         homeName: baseMatchData.homeName, awayName: baseMatchData.awayName,
         predictions: null, h2hSummary: null, homeForm: null, awayForm: null,
         homeStanding: null, awayStanding: null
     };

     if (predictionsData && Array.isArray(predictionsData) && predictionsData.length > 0) {
         analysisForAlgorithm.predictions = predictionsData[0].predictions || predictionsData[0];
     } else if (predictionsData && typeof predictionsData === 'object' && predictionsData.predictions) {
          analysisForAlgorithm.predictions = predictionsData.predictions;
     } else if (predictionsData && typeof predictionsData === 'object' && !predictionsData.message) {
         analysisForAlgorithm.predictions = predictionsData;
     }

    if (h2hData && Array.isArray(h2hData) && h2hData.length > 0) {
        let summary = { homeWins: 0, awayWins: 0, draws: 0, totalGoals: 0, total: 0, avgGoals: 0 };
         h2hData.forEach(m => {
            const hs = parseInt(m.match_hometeam_ft_score ?? m.match_hometeam_score);
            const as = parseInt(m.match_awayteam_ft_score ?? m.match_awayteam_score);
            if (!isNaN(hs) && !isNaN(as)) {
                summary.totalGoals += hs + as;
                 if (m.match_hometeam_id == baseMatchData.homeId) { if (hs > as) summary.homeWins++; else if (as > hs) summary.awayWins++; else summary.draws++; }
                 else if (m.match_awayteam_id == baseMatchData.homeId) { if (as > hs) summary.homeWins++; else if (hs > as) summary.awayWins++; else summary.draws++; }
                 else { if (hs === as) summary.draws++; }
                 summary.total++;
            }
        });
        if (summary.total > 0) summary.avgGoals = summary.totalGoals / summary.total;
        analysisForAlgorithm.h2hSummary = summary;
    }
    if (homeMatchesData) analysisForAlgorithm.homeForm = calculateFormString(baseMatchData.homeId, homeMatchesData);
    if (awayMatchesData) analysisForAlgorithm.awayForm = calculateFormString(baseMatchData.awayId, awayMatchesData);
    if (standingsData && Array.isArray(standingsData) && standingsData.length > 0) {
        analysisForAlgorithm.homeStanding = standingsData.find(t => t.team_id == baseMatchData.homeId) || null;
        analysisForAlgorithm.awayStanding = standingsData.find(t => t.team_id == baseMatchData.awayId) || null;
    }
    // --- Hata Gösterimi ---
    if (overallError) {
        modalError.textContent = `Analiz Hatası: ${overallError}`;
        modalError.style.display = 'block';
        if (overallError.includes("Limit")) {
             modalError.textContent += " API kullanım limitine ulaşıldı. Tahminler eksik veya hatalı olabilir.";
        }
    } else {
        modalError.style.display = 'none';
    }

    // --- Analiz Bölümlerini Oluşturma (HTML) ---
    let analysisHtml = '<div class="analysis-grid">'; // Grid yapısı için

    // 1. API Tahminleri
    analysisHtml += '<div class="analysis-section api-predictions"><h3><i class="fa-solid fa-robot"></i> API Tahminleri</h3>';
    if (analysisForAlgorithm.predictions?.percent?.home) {
        // ... (Mevcut yüzdesel gösterim kodu - değişiklik yok) ...
        const preds = analysisForAlgorithm.predictions;
        const homePercent = parseFloat(preds.percent.home.replace('%', '')) || 0;
        const drawPercent = parseFloat(preds.percent.draw?.replace('%', '')) || 0;
        const awayPercent = parseFloat(preds.percent.away.replace('%', '')) || 0;
        let probabilities = [
            { outcome: 'Ev Sahibi (1)', percent: homePercent, class: 'prediction-home' },
            { outcome: 'Beraberlik (X)', percent: drawPercent, class: 'prediction-draw' },
            { outcome: 'Deplasman (2)', percent: awayPercent, class: 'prediction-away' }
        ];
        probabilities.sort((a, b) => b.percent - a.percent);
        analysisHtml += `<ul>`;
        probabilities.forEach((p, index) => {
            const highlightClass = index === 0 ? ' highest-probability' : '';
            const highestText = index === 0 ? ' <strong class="highest-label">(En Yüksek)</strong>' : '';
            analysisHtml += `<li><span class="outcome-label ${highlightClass}">${p.outcome}:</span> <span class="prediction-percent ${p.class}">${p.percent.toFixed(1)}%</span>${highestText}</li>`;
        });
        analysisHtml += `</ul>`;
    } else if (analysisForAlgorithm.predictions?.prediction) { // Sadece metin varsa
        analysisHtml += `<p>API Metin Tahmini: <span class="highlight">${analysisForAlgorithm.predictions.prediction}</span></p>`;
    }
     else { analysisHtml += '<p>API tahmin verisi yok veya alınamadı.</p>'; }
    analysisHtml += '</div>';

    // 2. H2H (Head-to-Head) - Detaylı
    analysisHtml += '<div class="analysis-section h2h-details"><h3><i class="fa-solid fa-handshake"></i> H2H (Aralarındaki Maçlar)</h3>';
    if (analysisForAlgorithm.h2hSummary && h2hData && h2hData.length > 0) {
        const summary = analysisForAlgorithm.h2hSummary;
        analysisHtml += '<h4>Son Karşılaşmalar:</h4>';
        analysisHtml += '<ul class="h2h-match-list">';
        h2hData
            .sort((a, b) => new Date(b.match_date) - new Date(a.match_date))
            .slice(0, 7) // Son 7 maç
            .forEach(m => {
                const score = `${m.match_hometeam_ft_score ?? m.match_hometeam_score ?? '?'} - ${m.match_awayteam_ft_score ?? m.match_awayteam_score ?? '?'}`;
                let resultStyle = ""; let homeTeamText = m.match_hometeam_name; let awayTeamText = m.match_awayteam_name;
                const hs_n = parseInt(m.match_hometeam_ft_score ?? m.match_hometeam_score);
                const as_n = parseInt(m.match_awayteam_ft_score ?? m.match_awayteam_score);
                let venue = ""; // Maçın nerede oynandığı

                if (!isNaN(hs_n) && !isNaN(as_n)){
                    if (m.match_hometeam_id == baseMatchData.homeId) { // Analizdeki ev sahibi H2H'de de ev sahibi
                         venue = `(${homeTeamText} Evinde)`;
                         if (hs_n > as_n) { resultStyle = "h2h-win"; homeTeamText = `<strong>${homeTeamText}</strong>`; }
                         else if (as_n > hs_n) { resultStyle = "h2h-loss"; awayTeamText = `<strong>${awayTeamText}</strong>`;}
                         else resultStyle = "h2h-draw";
                    } else if (m.match_awayteam_id == baseMatchData.homeId) { // Analizdeki ev sahibi H2H'de deplasmanda
                         venue = `(${awayTeamText} Evinde)`;
                        if (as_n > hs_n) { resultStyle = "h2h-win"; awayTeamText = `<strong>${awayTeamText}</strong>`; }
                        else if (hs_n > as_n) { resultStyle = "h2h-loss"; homeTeamText = `<strong>${homeTeamText}</strong>`; }
                        else resultStyle = "h2h-draw";
                    } else { // Eşleşmeyen durum
                        venue = "(Tarafsız Saha?)";
                        if (hs_n === as_n) resultStyle = "h2h-draw";
                        if(hs_n > as_n) homeTeamText = `<strong>${homeTeamText}</strong>`; else if(as_n > hs_n) awayTeamText = `<strong>${awayTeamText}</strong>`;
                    }
                }
                analysisHtml += `<li class="${resultStyle}">
                                    <span class="h2h-date">${m.match_date} ${venue}:</span>
                                    <span class="h2h-teams">${homeTeamText} <span class="h2h-score">${score}</span> ${awayTeamText}</span>
                                 </li>`;
            });
        analysisHtml += '</ul>';
        analysisHtml += `<p class="h2h-summary">Özet (${summary.total} maç): ${baseMatchData.homeName} G: <span class="highlight">${summary.homeWins}</span> | B: <span class="highlight">${summary.draws}</span> | ${baseMatchData.awayName} G: <span class="highlight">${summary.awayWins}</span> | Ort. Gol: <span class="highlight">${summary.avgGoals.toFixed(2)}</span></p>`;
    } else { analysisHtml += '<p>H2H verisi yok veya alınamadı.</p>'; }
    analysisHtml += '</div>';

    // 3. Form (Son 5 Maç) - Ayrı Ayrı
     analysisHtml += `<div class="analysis-section form-details"><h3><i class="fa-solid fa-chart-line"></i> Form (Son 5 Maç)</h3>`;
     if (analysisForAlgorithm.homeForm?.matchesPlayed > 0) {
         const form = analysisForAlgorithm.homeForm;
         analysisHtml += `<div class="form-team">
                            <h4>${baseMatchData.homeName}</h4>
                            <p class="form-string">${form.string}</p>
                            <p>Puan: ${form.points} | AG: ${form.goalsScored} | YG: ${form.goalsConceded} | Avj: ${form.goalDiff > 0 ? '+' : ''}${form.goalDiff} | Maç Ort. Gol: ${form.avgGoals.toFixed(2)}</p>
                          </div>`;
     } else { analysisHtml += `<p>${baseMatchData.homeName}: Form verisi yok.</p>`; }
     if (analysisForAlgorithm.awayForm?.matchesPlayed > 0) {
         const form = analysisForAlgorithm.awayForm;
         analysisHtml += `<div class="form-team">
                            <h4>${baseMatchData.awayName}</h4>
                            <p class="form-string">${form.string}</p>
                            <p>Puan: ${form.points} | AG: ${form.goalsScored} | YG: ${form.goalsConceded} | Avj: ${form.goalDiff > 0 ? '+' : ''}${form.goalDiff} | Maç Ort. Gol: ${form.avgGoals.toFixed(2)}</p>
                          </div>`;
     } else { analysisHtml += `<p>${baseMatchData.awayName}: Form verisi yok.</p>`; }
      analysisHtml += '</div>';

    // 4. Puan Durumu & İç/Dış Performans
    analysisHtml += '<div class="analysis-section standings-details"><h3><i class="fa-solid fa-table-list"></i> Puan Durumu & Sezon İstatistikleri</h3>';
    if (analysisForAlgorithm.homeStanding && analysisForAlgorithm.awayStanding) {
        const homeS = analysisForAlgorithm.homeStanding;
        const awayS = analysisForAlgorithm.awayStanding;
        const homePPG = (parseInt(homeS.overall_league_PTS) / parseInt(homeS.overall_league_payed)).toFixed(2);
        const awayPPG = (parseInt(awayS.overall_league_PTS) / parseInt(awayS.overall_league_payed)).toFixed(2);
        const homeAvgGF = (parseInt(homeS.overall_league_GF) / parseInt(homeS.overall_league_payed)).toFixed(2);
        const homeAvgGA = (parseInt(homeS.overall_league_GA) / parseInt(homeS.overall_league_payed)).toFixed(2);
        const awayAvgGF = (parseInt(awayS.overall_league_GF) / parseInt(awayS.overall_league_payed)).toFixed(2);
        const awayAvgGA = (parseInt(awayS.overall_league_GA) / parseInt(awayS.overall_league_payed)).toFixed(2);

         analysisHtml += `<div class="standings-team">
                            <h4>${homeS.team_name} (Genel)</h4>
                            <p>Sıra: ${homeS.overall_league_position} | Puan: ${homeS.overall_league_PTS} (Ort: ${homePPG})</p>
                            <p>Maç: ${homeS.overall_league_payed} | G-B-M: ${homeS.overall_league_W}-${homeS.overall_league_D}-${homeS.overall_league_L}</p>
                            <p>AG: ${homeS.overall_league_GF} (Ort: ${homeAvgGF}) | YG: ${homeS.overall_league_GA} (Ort: ${homeAvgGA}) | Avj: ${homeS.overall_league_GD}</p>
                          </div>`;
         analysisHtml += `<div class="standings-team">
                            <h4>${awayS.team_name} (Genel)</h4>
                             <p>Sıra: ${awayS.overall_league_position} | Puan: ${awayS.overall_league_PTS} (Ort: ${awayPPG})</p>
                            <p>Maç: ${awayS.overall_league_payed} | G-B-M: ${awayS.overall_league_W}-${awayS.overall_league_D}-${awayS.overall_league_L}</p>
                            <p>AG: ${awayS.overall_league_GF} (Ort: ${awayAvgGF}) | YG: ${awayS.overall_league_GA} (Ort: ${awayAvgGA}) | Avj: ${awayS.overall_league_GD}</p>
                          </div>`;

        // Ev/Dep Performansı (varsa)
        if(homeS.home_league_W !== undefined && awayS.away_league_W !== undefined && homeS.home_league_payed > 0 && awayS.away_league_payed > 0) {
            const homeHomePPG = ((parseInt(homeS.home_league_W)*3 + parseInt(homeS.home_league_D)) / parseInt(homeS.home_league_payed)).toFixed(2);
            const awayAwayPPG = ((parseInt(awayS.away_league_W)*3 + parseInt(awayS.away_league_D)) / parseInt(awayS.away_league_payed)).toFixed(2);
            analysisHtml += `<h4 class="sub-header">İç Saha / Dış Saha Detayları:</h4>
                             <div class="standings-team detail">
                                <h5>${homeS.team_name} (Evinde)</h5>
                                <p>Maç: ${homeS.home_league_payed} | G-B-M: ${homeS.home_league_W}-${homeS.home_league_D}-${homeS.home_league_L} | Puan Ort: ${homeHomePPG}</p>
                                <p>AG: ${homeS.home_league_GF} | YG: ${homeS.home_league_GA}</p>
                             </div>
                             <div class="standings-team detail">
                                <h5>${awayS.team_name} (Deplasmanda)</h5>
                                <p>Maç: ${awayS.away_league_payed} | G-B-M: ${awayS.away_league_W}-${awayS.away_league_D}-${awayS.away_league_L} | Puan Ort: ${awayAwayPPG}</p>
                                <p>AG: ${awayS.away_league_GF} | YG: ${awayS.away_league_GA}</p>
                             </div>`;
        }
    } else { analysisHtml += '<p>Puan durumu verisi yok veya alınamadı.</p>'; }
    analysisHtml += '</div>';

    // 5. Oranlar
    analysisHtml += '<div class="analysis-section odds-details"><h3><i class="fa-solid fa-scale-balanced"></i> Oranlar (Örnekler)</h3>';
    if (oddsData && typeof oddsData === 'object') {
        const matchOdds = Array.isArray(oddsData) ? oddsData[0] : oddsData; // API bazen array, bazen obje dönebiliyor
        analysisHtml += '<table class="odds-table"><thead><tr><th>Site</th><th>1</th><th>X</th><th>2</th></tr></thead><tbody>';
        let oddsFound = false;
        const maxBookmakersToShow = 3;
        let displayedBookmakers = 0;

        // Yeni API Formatı (bookmakers array'i içinde)
        if (matchOdds?.bookmakers && Array.isArray(matchOdds.bookmakers)) {
             matchOdds.bookmakers.forEach(bk => {
                 if (displayedBookmakers >= maxBookmakersToShow) return;
                  // Hem 'Match Result' hem de '1X2' isimlerini kontrol et
                 const odds1X2 = bk.odds.find(o => ["Match Result", "1X2"].includes(o.odd_name));
                 if (odds1X2?.odd_value && odds1X2.odd_value.split('/').length === 3) {
                     const [odd1, oddX, odd2] = odds1X2.odd_value.split('/');
                     const bookmakerName = bk.bookmaker_name || `Bilinmeyen ${displayedBookmakers + 1}`;
                     analysisHtml += `<tr><td class="bookmaker-name">${bookmakerName.substring(0, 15)}</td><td>${odd1}</td><td>${oddX}</td><td>${odd2}</td></tr>`;
                     oddsFound = true;
                     displayedBookmakers++;
                 }
             });
        }
         // Eski API Formatı (odds array'i içinde odd_bookmakers)
         else if (!oddsFound && matchOdds?.odds && Array.isArray(matchOdds.odds)) {
              const oddsWithBookmakers = matchOdds.odds.find(o => o.odd_bookmakers && Array.isArray(o.odd_bookmakers));
              if (oddsWithBookmakers) {
                  oddsWithBookmakers.odd_bookmakers.slice(0, maxBookmakersToShow).forEach(bk => {
                      if (bk.odd_value_1 && bk.odd_value_x && bk.odd_value_2) {
                         const bookmakerName = bk.bookmaker_name || `Bilinmeyen ${displayedBookmakers + 1}`;
                         analysisHtml += `<tr><td class="bookmaker-name">${bookmakerName.substring(0, 15)}</td><td>${bk.odd_value_1}</td><td>${bk.odd_value_x}</td><td>${bk.odd_value_2}</td></tr>`;
                         oddsFound = true;
                         displayedBookmakers++;
                      }
                  });
              }
         }

        analysisHtml += '</tbody></table>';
        if (!oddsFound) { analysisHtml += '<p>1X2 Oranları bulunamadı.</p>'; }
    } else { analysisHtml += '<p>Oran verisi yok veya alınamadı.</p>'; }
    analysisHtml += '</div>';

    // --- Grid Kapatma ---
    analysisHtml += '</div>'; // .analysis-grid sonu

    // --- Algoritma Sonuçlarını Gösterme (Grid Dışında, Alt Bölüm) ---
    modalAnalysisContent.innerHTML += analysisHtml; // Önceki HTML'i ekle

    // 1. Maç Sonucu Tahmini ve Güven Skoru
    const suggestionResult = determineSuggestedBet(analysisForAlgorithm);
    const confidenceScoreSection = document.createElement('div');
    confidenceScoreSection.id = 'confidenceScoreSection';
    confidenceScoreSection.className = 'analysis-section confidence-section';
    confidenceScoreSection.innerHTML = `
        <h3><i class="fa-solid fa-tachometer-alt"></i> Maç Sonucu Güven Skoru</h3>
        <div class="confidence-bar-container">
            <div class="confidence-bar">
                <span class="confidence-indicator" style="left: ${suggestionResult.confidenceScore.toFixed(0)}%;"></span>
                <span class="confidence-score-text">${suggestionResult.confidenceScore.toFixed(0)}</span>
            </div>
        </div>
        <div class="confidence-labels">
            <span>Depl. Güçlü (${STRONG_CONFIDENCE_THRESHOLD_LOWER}↓)</span>
            <span>Dengeli/Riskli</span>
            <span>Ev Sah. Güçlü (${STRONG_CONFIDENCE_THRESHOLD_UPPER}↑)</span>
        </div>
         <p class="ai-reason summary"><i class="fa-solid fa-lightbulb"></i> <b>Anahtar Faktörler:</b> ${suggestionResult.reason}</p>
    `;
    modalAnalysisContent.appendChild(confidenceScoreSection);

    // 2. Toplam Gol Tahmini (Daha Detaylı)
    const goalPredictionResult = predictTotalGoals(analysisForAlgorithm);
    const goalPredictionSection = document.createElement('div');
    goalPredictionSection.id = 'goalPredictionSection';
    goalPredictionSection.className = 'analysis-section goal-prediction-section';
    goalPredictionSection.innerHTML = `
        <h3><i class="fa-solid fa-bullseye"></i> Gol Tahminleri</h3>
        <div class="goal-prediction-grid">
            <div class="goal-item">
                <span class="goal-label">Tahmini Toplam Gol:</span>
                <span class="goal-value highlight">${goalPredictionResult.estimatedTotalGoals}</span>
            </div>
            <div class="goal-item">
                <span class="goal-label">Beklenen Gol (Ev):</span>
                <span class="goal-value">${goalPredictionResult.homeExpectedGoals}</span>
            </div>
            <div class="goal-item">
                <span class="goal-label">Beklenen Gol (Dep):</span>
                <span class="goal-value">${goalPredictionResult.awayExpectedGoals}</span>
            </div>
             <div class="goal-item">
                 <span class="goal-label">Alt/Üst ${overUnderThreshold}:</span>
                 <span class="goal-value highlight">${goalPredictionResult.overUnder25}</span>
            </div>
             <div class="goal-item kg-item">
                 <span class="goal-label">KG Durumu:</span>
                 <span class="goal-value highlight">${goalPredictionResult.kgVarYok}</span>
            </div>
        </div>
        <p class="goal-text summary"><i class="fa-solid fa-futbol"></i> ${goalPredictionResult.predictionText}</p>
    `;
    modalAnalysisContent.appendChild(goalPredictionSection);


    // 3. Öneri ve Butonlar Bölümü
    currentMatchDataForHighlight = {
        ...baseMatchData,
        suggestion: suggestionResult.suggestion,
        confidenceScore: suggestionResult.confidenceScore,
        reason: suggestionResult.reason,
        goalPrediction: goalPredictionResult.overUnder25, // Öne çıkanlara Alt/Üst eklenebilir
        kgVarYok: goalPredictionResult.kgVarYok // KG durumu da eklenebilir
    };
    currentMatchDataForCoupon = { ...currentMatchDataForHighlight, isStrong: suggestionResult.isStrong };

    const suggestionSection = document.createElement('div');
    suggestionSection.id = 'suggestedBetSection';
    suggestionSection.innerHTML = `
        <h4><i class="fa-solid fa-brain"></i> Algoritmik Öneri Özeti</h4>
        <div class="ai-suggestion">
            <span class="${suggestionResult.cssClass}">${suggestionResult.suggestion}</span>
            <span class="confidence-display">(Güven: ${suggestionResult.confidenceScore.toFixed(0)}/100)</span>
             ${suggestionResult.isStrong ? '<span class="strong-badge modal-badge" title="Güçlü Tahmin">★ Güçlü</span>' : ''}
        </div>
        <div class="action-buttons">
            <button class="add-highlight-button action-button"><i class="fa-solid fa-star"></i> Öne Çıkanlara Ekle</button>
            <button class="add-coupon-button action-button"><i class="fa-solid fa-receipt"></i> Kupona Manuel Ekle</button>
        </div>
        <strong class="ai-warning">⚠️ UYARI: Bu sadece algoritmik bir öneridir ve bilgilendirme amaçlıdır. Bahisler kendi sorumluluğunuzdadır. Eksik veri, sakatlık, ceza gibi faktörler sonucu etkileyebilir. API limitleri analizi kısıtlayabilir.</strong>
    `;
    modalAnalysisContent.appendChild(suggestionSection);

    // Butonların durumunu ve olaylarını ayarla
    const highlightButton = suggestionSection.querySelector('.add-highlight-button');
    const couponButton = suggestionSection.querySelector('.add-coupon-button');
    // ... (Mevcut buton lojiği - değişiklik yok) ...
    if (highlightButton) {
        const highlights = getHighlightsFromStorage();
        const isAlreadyHighlighted = highlights.some(h => h.matchId === currentMatchDataForHighlight.matchId);
        if (isAlreadyHighlighted) {
            highlightButton.innerHTML = '<i class="fa-solid fa-check"></i> Öne Çıkanlarda';
            highlightButton.disabled = true;
        } else {
            highlightButton.onclick = () => addMatchToHighlights(highlightButton);
        }
    }

    if (couponButton) {
        const couponMatches = getCouponFromStorage();
        const isAlreadyInCoupon = couponMatches.some(m => m.matchId === currentMatchDataForCoupon.matchId);
         if (isAlreadyInCoupon) {
            couponButton.innerHTML = '<i class="fa-solid fa-check"></i> Kuponda';
            couponButton.disabled = true;
        } else {
            couponButton.onclick = () => addMatchToCoupon(couponButton);
        }
    }
}


// --- Öne Çıkanlar (Highlights) Fonksiyonları ---
function getHighlightsFromStorage() {
    // ... (Mevcut kod - v3 zaten kullanılıyor) ...
    try {
        const stored = localStorage.getItem('highlightedMatches_v3');
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Highlight local storage okuma hatası:", e);
        localStorage.removeItem('highlightedMatches_v3'); // Hatalı veriyi temizle
        return [];
    }
}
function saveHighlightsToStorage(highlights) {
    // ... (Mevcut kod - v3 zaten kullanılıyor) ...
    try {
        highlights.sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));
        localStorage.setItem('highlightedMatches_v3', JSON.stringify(highlights));
    } catch (e) {
        console.error("Highlight local storage yazma hatası:", e);
        alert("Öne çıkanlar kaydedilirken bir hata oluştu. Tarayıcı belleği dolu olabilir.");
    }
}
function addMatchToHighlights(buttonElement) {
    // ... (Mevcut kod - v3 uyumlu) ...
    if (!currentMatchDataForHighlight || !currentMatchDataForHighlight.matchId) {
        console.error("Öne çıkarılacak maç verisi bulunamadı.");
        return;
    }
    if (!currentMatchDataForHighlight.suggestion) currentMatchDataForHighlight.suggestion = "Analiz Edilmedi";

    const highlights = getHighlightsFromStorage();
    if (highlights.some(h => h.matchId === currentMatchDataForHighlight.matchId)) {
        if (buttonElement) { buttonElement.innerHTML = '<i class="fa-solid fa-check"></i> Öne Çıkanlarda'; buttonElement.disabled = true; }
        return;
    }
    highlights.push(currentMatchDataForHighlight);
    saveHighlightsToStorage(highlights);

    if (buttonElement) {
        buttonElement.innerHTML = '<i class="fa-solid fa-check"></i> Eklendi';
        buttonElement.disabled = true;
    }
    if (currentView === 'highlights') {
        displayHighlights(); // Görünümü güncelle
    }
     // Kupon görünümünü de güncellemek iyi olabilir (opsiyonel)
     if (currentView === 'coupon') {
         displayCoupon();
     }
}
function clearHighlights() {
    // ... (Mevcut kod - v3 uyumlu) ...
    if (confirm("Öne çıkanlar listesini tamamen temizlemek istediğinize emin misiniz?")) {
        try {
            localStorage.removeItem('highlightedMatches_v3');
            displayHighlights(); // Görünümü hemen güncelle
        } catch (e) {
             console.error("Highlight temizleme hatası:", e);
        }
    }
}
function displayHighlights() {
    // ... (Mevcut kod - v3 uyumlu, KG Var/Yok eklendi) ...
    showLoading('highlights');
    highlightsList.innerHTML = '';
    clearError('highlights');
    const highlights = getHighlightsFromStorage();

    if (highlights.length === 0) {
        highlightsList.innerHTML = '<li>Henüz öne çıkanlara eklenmiş maç yok. Analiz ekranından ekleyebilirsiniz.</li>';
        clearHighlightsButton.style.display = 'none';
    } else {
        highlights.forEach(match => {
            const li = document.createElement('li');
             let suggestionClass = 'suggestion-neutral';
             const suggestionText = match.suggestion || 'N/A';
             if (suggestionText.includes('(1)')) suggestionClass = 'suggestion-home';
             else if (suggestionText.includes('(X)')) suggestionClass = 'suggestion-draw';
             else if (suggestionText.includes('(2)')) suggestionClass = 'suggestion-away';

            li.innerHTML = `
                 <div class="match-info-base">
                     <span class="teams-base">${match.homeName} vs ${match.awayName}</span>
                     <span class="date-base">${match.matchDate}</span>
                 </div>
                 <div class="suggestion-base ${suggestionClass}">
                    ${suggestionText} ${match.confidenceScore ? `(Skor: ${match.confidenceScore.toFixed(0)})` : ''}
                 </div>
                 ${match.reason ? `<div class="coupon-reason"><b>Neden:</b> ${match.reason}</div>` : ''}
                 ${match.goalPrediction ? `<div class="coupon-reason goal-pred"><b>Alt/Üst:</b> ${match.goalPrediction}</div>` : ''}
                 ${match.kgVarYok ? `<div class="coupon-reason kg-pred"><b>KG:</b> ${match.kgVarYok}</div>` : ''}
            `;
            highlightsList.appendChild(li);
        });
        clearHighlightsButton.style.display = 'block';
    }
    hideLoading('highlights');
}


// --- Kupon Fonksiyonları ---
function getCouponFromStorage() {
    // ... (Mevcut kod - v3 uyumlu) ...
    try {
        const stored = localStorage.getItem('couponMatches_v3');
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Coupon local storage okuma hatası:", e);
         localStorage.removeItem('couponMatches_v3'); // Hatalı veriyi temizle
        return [];
    }
}
function saveCouponToStorage(couponMatches) {
    // ... (Mevcut kod - v3 uyumlu, lig adına göre sıralama) ...
    try {
         couponMatches.sort((a, b) => {
             const leagueA = leagues.find(l => l.id === a.leagueId)?.name || `Lig ${a.leagueId}`;
             const leagueB = leagues.find(l => l.id === b.leagueId)?.name || `Lig ${b.leagueId}`;
             if (leagueA < leagueB) return -1;
             if (leagueA > leagueB) return 1;
             // Aynı ligdeyse tarihe göre sırala
             return new Date(`${a.matchDate} 00:00`) - new Date(`${b.matchDate} 00:00`);
         });
        localStorage.setItem('couponMatches_v3', JSON.stringify(couponMatches));
    } catch (e) {
        console.error("Coupon local storage yazma hatası:", e);
         alert("Kupon kaydedilirken bir hata oluştu. Tarayıcı belleği dolu olabilir.");
    }
}
function addMatchToCoupon(buttonElement) {
    // ... (Mevcut kod - v3 uyumlu) ...
    if (!currentMatchDataForCoupon || !currentMatchDataForCoupon.matchId) {
         console.error("Kupona eklenecek maç verisi bulunamadı.");
        return;
    }
     if (!currentMatchDataForCoupon.suggestion) {
         alert("Bu maç için henüz bir öneri hesaplanmadı.");
         return;
     }

    const couponMatches = getCouponFromStorage();
    if (couponMatches.some(m => m.matchId === currentMatchDataForCoupon.matchId)) {
        if (buttonElement) { buttonElement.innerHTML = '<i class="fa-solid fa-check"></i> Kuponda'; buttonElement.disabled = true; }
        return;
    }
    couponMatches.push(currentMatchDataForCoupon); // isStrong, goalPrediction, kgVarYok bilgileri de ekleniyor
    saveCouponToStorage(couponMatches);

    if (buttonElement) {
        buttonElement.innerHTML = '<i class="fa-solid fa-check"></i> Kupona Eklendi';
        buttonElement.disabled = true;
    }
    if (currentView === 'coupon') {
        displayCoupon(); // Kupon görünümünü güncelle
    }
    // Öne çıkanlar görünümünü de güncellemek iyi olabilir (opsiyonel)
    if (currentView === 'highlights') {
         displayHighlights();
    }
}
function clearCoupon() {
    // ... (Mevcut kod - v3 uyumlu) ...
    if (confirm("Kuponu tamamen temizlemek istediğinize emin misiniz?")) {
        try {
            localStorage.removeItem('couponMatches_v3');
            displayCoupon(); // Görünümü hemen güncelle
        } catch (e) {
             console.error("Kupon temizleme hatası:", e);
        }
    }
}
function displayCoupon() {
    // ... (Mevcut kod - v3 uyumlu, KG Var/Yok eklendi) ...
    showLoading('coupon');
    couponList.innerHTML = '';
    clearError('coupon');
    const couponMatches = getCouponFromStorage();

    if (couponMatches.length === 0) {
        couponList.innerHTML = '<li>Kuponunuza henüz maç eklenmedi. Gelecek maçlar sekmesinden otomatik analizle veya maç analiz ekranından manuel ekleyebilirsiniz.</li>';
        clearCouponButton.style.display = 'none';
    } else {
        const groupedByLeague = couponMatches.reduce((acc, match) => {
            const leagueName = leagues.find(l => l.id === match.leagueId)?.name || `Bilinmeyen Lig (${match.leagueId})`;
            if (!acc[leagueName]) acc[leagueName] = [];
            acc[leagueName].push(match);
            return acc;
        }, {});

        const sortedLeagueNames = Object.keys(groupedByLeague).sort();

        sortedLeagueNames.forEach(leagueName => {
            const leagueHeader = document.createElement('li');
            leagueHeader.className = 'league-header';
            leagueHeader.innerHTML = `<i class="fa-solid fa-trophy"></i> ${leagueName}`; // Lig ikonunu ekle
            couponList.appendChild(leagueHeader);

            // Lig içindeki maçları tarihe göre sırala
            groupedByLeague[leagueName].sort((a, b) => new Date(`${a.matchDate} 00:00`) - new Date(`${b.matchDate} 00:00`));

            groupedByLeague[leagueName].forEach(match => {
                const li = document.createElement('li');
                 let suggestionClass = 'suggestion-neutral';
                 const suggestionText = match.suggestion || 'N/A';
                  if (suggestionText.includes('(1)')) suggestionClass = 'suggestion-home';
                  else if (suggestionText.includes('(X)')) suggestionClass = 'suggestion-draw';
                  else if (suggestionText.includes('(2)')) suggestionClass = 'suggestion-away';

                 const strongBadge = match.isStrong ? '<span class="strong-badge" title="Güçlü Tahmin">★</span>' : '';

                 li.innerHTML = `
                    <div class="match-info-base">
                        <span class="teams-base">${match.homeName} vs ${match.awayName}</span>
                        <span class="date-base">${match.matchDate}</span>
                    </div>
                    <div class="suggestion-base ${suggestionClass}">
                        ${strongBadge} ${suggestionText} ${match.confidenceScore ? `(Skor: ${match.confidenceScore.toFixed(0)})` : ''}
                    </div>
                     ${match.reason ? `<div class="coupon-reason"><b>Neden:</b> ${match.reason}</div>` : ''}
                     <div class="coupon-extra-preds">
                        ${match.goalPrediction ? `<span class="coupon-reason goal-pred"><i class="fa-solid fa-bullseye"></i> ${match.goalPrediction}</span>` : ''}
                        ${match.kgVarYok ? `<span class="coupon-reason kg-pred"><i class="fa-solid fa-exchange-alt"></i> ${match.kgVarYok}</span>` : ''}
                     </div>
                     `;
                couponList.appendChild(li);
            });
        });
        clearCouponButton.style.display = 'block';
    }
    hideLoading('coupon');
}


// --- Otomatik Analiz ve Kupona Ekleme (Toplu) ---
async function analyzeUpcomingAndAddToCoupon(leagueId) {
    // ... (Mevcut kod - Hata yönetimi iyileştirildi, KG/Gol tahmini eklendi) ...
    if (isAutoAnalyzing) {
        console.log("Otomatik analiz zaten çalışıyor.");
        showAutoAnalysisStatus("Analiz zaten devam ediyor...", "loading");
        return;
    }
    isAutoAnalyzing = true;
    if (analyzeUpcomingBtn) analyzeUpcomingBtn.disabled = true;
    let addedCount = 0;
    let analysisErrors = 0;
    let apiLimitReached = false;
    const leagueName = leagues.find(l => l.id === leagueId)?.name || 'Seçili lig';
    showAutoAnalysisStatus(`${leagueName} için toplu analiz başlatıldı... Maçlar alınıyor...`, 'loading');

    const today = new Date();
    const future = new Date();
    future.setDate(today.getDate() + 7);
    const fromDate = formatDate(today);
    const toDate = formatDate(future);
    let upcomingMatches = [];

    try {
        const upcomingMatchesRaw = await fetchMatches(leagueId, fromDate, toDate);
         upcomingMatches = upcomingMatchesRaw && Array.isArray(upcomingMatchesRaw)
            ? upcomingMatchesRaw.filter(m => !m.match_status || ['Not Started', 'Time to be defined'].includes(m.match_status) || m.match_status?.includes(':'))
            : []; // Hata veya null ise boş array yap
    } catch (error) {
         if (error.message?.toLowerCase().includes("limit")) {
             apiLimitReached = true;
             showAutoAnalysisStatus(`${leagueName} için maçlar alınırken API Limitine ulaşıldı! Analiz durduruldu.`, 'error');
         } else {
            showAutoAnalysisStatus(`${leagueName} için gelecek maçlar alınamadı: ${error.message}`, 'error');
         }
         isAutoAnalyzing = false;
         if (analyzeUpcomingBtn && selectedLeagueId) analyzeUpcomingBtn.disabled = false;
         return; // Maçları alamadıysak devam etme
    }


    if (upcomingMatches.length > 0) {
        console.log(`${upcomingMatches.length} analiz edilecek maç bulundu.`);
        let analyzedCount = 0;
        const existingCoupon = getCouponFromStorage();
        const newPredictionsForCoupon = [];

        for (const match of upcomingMatches) {
            // Eğer önceki adımda limit hatası alındıysa döngüyü kır
            if (apiLimitReached) break;

            analyzedCount++;
            showAutoAnalysisStatus(`${leagueName}: ${analyzedCount}/${upcomingMatches.length} maç analiz ediliyor (${match.match_hometeam_name.substring(0,3)}..-${match.match_awayteam_name.substring(0,3)}..)`, 'loading');

            if (!match.match_id || !match.league_id || !match.match_hometeam_id || !match.match_awayteam_id || !match.match_hometeam_name || !match.match_awayteam_name) {
                console.warn("Eksik maç bilgisi, atlanıyor:", match.match_id || 'ID yok');
                continue;
            }
            if (existingCoupon.some(existing => existing.matchId === match.match_id)) {
                console.log(`Maç (${match.match_id}) zaten kuponda, atlanıyor.`);
                continue;
            }

            try {
                const analysisInput = await getAnalysisDataForMatch(match);
                // getAnalysisDataForMatch içinde limit hatası fırlatılmış olabilir, burada yakala
                const suggestionResult = determineSuggestedBet(analysisInput);
                const goalPredictionResult = predictTotalGoals(analysisInput);

                if (suggestionResult.isStrong) {
                    console.log(`--> Güçlü Tahmin [Otomatik]: ${match.match_hometeam_name} vs ${match.match_awayteam_name} -> ${suggestionResult.suggestion} (${suggestionResult.confidenceScore.toFixed(0)})`);
                    const couponData = {
                        matchId: match.match_id, leagueId: match.league_id,
                        homeId: match.match_hometeam_id, awayId: match.match_awayteam_id,
                        homeName: match.match_hometeam_name, awayName: match.match_awayteam_name,
                        matchDate: match.match_date,
                        suggestion: suggestionResult.suggestion,
                        confidenceScore: suggestionResult.confidenceScore,
                        reason: suggestionResult.reason,
                        goalPrediction: goalPredictionResult.overUnder25, // Alt/Üst bilgisi
                        kgVarYok: goalPredictionResult.kgVarYok,       // KG Var/Yok bilgisi
                        isStrong: true
                    };
                    if (!newPredictionsForCoupon.some(newP => newP.matchId === couponData.matchId)) {
                        newPredictionsForCoupon.push(couponData);
                        addedCount++;
                    }
                }
            } catch (error) {
                console.error(`Otomatik maç analizi hatası (${match.match_id}):`, error);
                if (error.message?.toLowerCase().includes("limit")) {
                    apiLimitReached = true; // API limitine ulaşıldı, döngüyü sonraki iterasyonda kıracak
                    showAutoAnalysisStatus(`Analiz sırasında API Limitine ulaşıldı! (${analyzedCount}/${upcomingMatches.length} tamamlandı). Kalan maçlar analiz edilemedi.`, 'error');
                } else {
                    analysisErrors++; // Diğer hataları say
                }
            }
            // API rate limit için bekleme
             if (!apiLimitReached) { // Limit dolmadıysa bekle
                 await new Promise(resolve => setTimeout(resolve, 350)); // 350ms
             }
        } // End for loop

        if (addedCount > 0) {
            const updatedCoupon = [...existingCoupon, ...newPredictionsForCoupon];
            saveCouponToStorage(updatedCoupon);
             const errorMsg = analysisErrors > 0 ? ` (${analysisErrors} maçta analiz hatası oluştu.)` : '';
             const limitMsg = apiLimitReached ? ' API limitine ulaşıldığı için bazı maçlar analiz edilemedi.' : '';
            showAutoAnalysisStatus(`Analiz tamamlandı. ${addedCount} yeni güçlü tahmin kupona eklendi.${errorMsg}${limitMsg}`, 'success');
            if (currentView === 'coupon') displayCoupon(); // Kupon görünümünü güncelle
        } else if (!apiLimitReached) { // Limit dolmadıysa ve eklenen yoksa
             const errorMsg = analysisErrors > 0 ? ` (${analysisErrors} maçta analiz hatası oluştu.)` : '';
            showAutoAnalysisStatus(`Analiz tamamlandı. Yeni güçlü tahmin bulunamadı veya mevcutlar güncel.${errorMsg}`, 'success');
        }
        // Eğer limit dolduysa ve hiç eklenemediyse zaten yukarıda mesaj verildi.

    } else if (upcomingMatches.length === 0 && !apiLimitReached) { // Maç yoksa ve limit dolmadıysa
        showAutoAnalysisStatus(`${leagueName} için analiz edilecek (henüz başlamamış) maç bulunamadı.`, 'success');
    }
    // Eğer maçlar alınırken limit dolduysa mesaj yukarıda verildi.

    isAutoAnalyzing = false;
    if (analyzeUpcomingBtn && selectedLeagueId) analyzeUpcomingBtn.disabled = false;
    // Durum mesajını biraz daha uzun süre gösterelim
    setTimeout(hideAutoAnalysisStatus, apiLimitReached || analysisErrors > 0 ? 10000 : 6000);
}


// --- Data Loading Logic ---
async function loadDataForView(viewId) {
    // ... (Mevcut kod - Hata yakalama ve limit kontrolü eklendi) ...
     if (!selectedLeagueId && viewId !== 'highlights' && viewId !== 'coupon') {
        // ... (lig seçilmedi durumu) ...
        return;
    }

    showLoading(viewId);
    clearError(viewId);

    try {
        let data;
        if (viewId === 'standings') {
            data = await fetchStandings(selectedLeagueId);
            displayStandings(data);
        } else if (viewId === 'topscorers') {
            data = await fetchTopScorers(selectedLeagueId);
            displayTopScorers(data);
        } else if (viewId === 'recent' || viewId === 'upcoming') {
            const today = new Date();
            let fromDate, toDate;
            const daysInterval = 7;

            if (viewId === 'recent') {
                const pastDate = new Date(today);
                pastDate.setDate(today.getDate() - daysInterval);
                fromDate = formatDate(pastDate);
                toDate = formatDate(today);
                data = await fetchMatches(selectedLeagueId, fromDate, toDate, null, 'Finished'); // Sadece bitenler
            } else { // upcoming
                const futureDate = new Date(today);
                futureDate.setDate(today.getDate() + daysInterval);
                 fromDate = formatDate(today);
                 toDate = formatDate(futureDate);
                 // Gelecek maçlar için status belirtmiyoruz (başlamamış, ertelenmiş vb. hepsi gelebilir)
                 data = await fetchMatches(selectedLeagueId, fromDate, toDate);
            }
            const listElementId = viewId === 'recent' ? 'recentMatchesList' : 'upcomingMatchesList';
            displayMatches(listElementId, data, viewId);
        } else if (viewId === 'highlights') {
             displayHighlights(); // Bu zaten kendi içinde loading/error yönetiyor
        } else if (viewId === 'coupon') {
             displayCoupon(); // Bu zaten kendi içinde loading/error yönetiyor
        }

        // Highlights ve Coupon kendi hideLoading'ini yapar
        if (viewId !== 'highlights' && viewId !== 'coupon') {
             hideLoading(viewId);
        }

    } catch (error) {
         console.error(`Veri yükleme hatası (${viewId}):`, error);
         // Eğer limit hatası ise özel mesaj göster
         if (error.message?.toLowerCase().includes("limit")) {
             showError(viewId, "API Limitine ulaşıldı! Veri yüklenemedi.");
         } else {
            showError(viewId, error.message || 'Veri yüklenirken bilinmeyen bir hata oluştu.');
         }
    }
}


// --- Initialization and Event Listeners ---
function populateLeagueSelect() {
    // ... (Mevcut kod - değişiklik yok) ...
    leagues.forEach(league => {
        const option = document.createElement('option');
        option.value = league.id;
        option.textContent = league.name;
        leagueSelect.appendChild(option);
    });
}

function setupEventListeners() {
    // ... (Mevcut kod - isAutoAnalyzing kontrolü eklendi) ...
     leagueSelect.addEventListener('change', (e) => {
        if (isAutoAnalyzing) {
            alert("Otomatik analiz devam ederken lig değiştirilemez. Lütfen tamamlanmasını bekleyin.");
            e.target.value = selectedLeagueId || ""; // Önceki değere geri dön
            return;
        }
        selectedLeagueId = e.target.value;
        currentStandingsData = null;
        currentTopScorersData = null;
        apiCallCount = 0; // Lig değişince sayacı sıfırla (veya başka bir mantık?)
        updateApiStatus('Bilinmiyor'); // Durumu sıfırla

        const analyzeBtn = document.getElementById('analyzeUpcomingButton');
        const highlightButtonNav = document.querySelector('.nav-button[data-view="highlights"]');
        const couponButtonNav = document.querySelector('.nav-button[data-view="coupon"]');
        // Öne Çıkanlar ve Kupon her zaman etkin olmalı
        if(highlightButtonNav) highlightButtonNav.disabled = false;
        if(couponButtonNav) couponButtonNav.disabled = false;


        if (selectedLeagueId) {
            // Diğer nav butonlarını etkinleştir
            navButtons.forEach(button => {
                 if (button.dataset.view !== 'highlights' && button.dataset.view !== 'coupon') {
                     button.disabled = false;
                 }
            });
            // Lig seçildiğinde içerikleri temizle (highlights/coupon hariç)
             contentDivs.forEach(div => {
                if (div.id !== 'highlights' && div.id !== 'coupon') {
                    const tableBody = div.querySelector('tbody');
                    const matchList = div.querySelector('.match-list');
                    if (tableBody) tableBody.innerHTML = ''; // Temizle
                    if (matchList) matchList.innerHTML = ''; // Temizle
                    clearError(div.id); // Hataları temizle
                     const loading = div.querySelector('.loading'); // Yükleniyor göstergesini hazırla
                     if(loading) loading.style.display = 'none';
                }
            });


            if (analyzeBtn) analyzeBtn.disabled = false; // Analiz butonunu etkinleştir

            // Mevcut görünüm highlights veya coupon değilse, onu yükle
            if (currentView !== 'highlights' && currentView !== 'coupon') {
                loadDataForView(currentView);
            } else {
                 // Değilse, standings'e geç ve yükle
                 updateActiveView('standings');
                 loadDataForView('standings');
            }
             hideAutoAnalysisStatus(); // Varsa otomatik analiz durumunu gizle

        } else { // Lig seçimi kaldırıldı
            // Diğer nav butonlarını devre dışı bırak
            navButtons.forEach(button => {
                 if (button.dataset.view !== 'highlights' && button.dataset.view !== 'coupon') {
                     button.disabled = true;
                 }
            });
             // İçerikleri "Lütfen lig seçin" mesajıyla doldur
            contentDivs.forEach(div => {
                 if (div.id !== 'highlights' && div.id !== 'coupon') {
                    const tableBody = div.querySelector('tbody');
                    const matchList = div.querySelector('.match-list');
                    const loading = div.querySelector('.loading');
                    const error = div.querySelector('.error'); // Hata mesajını da gizle

                    if (tableBody && div.id === 'standings') tableBody.innerHTML = `<tr><td colspan="12">Lütfen bir lig seçin.</td></tr>`;
                    else if (tableBody && div.id === 'topscorers') tableBody.innerHTML = `<tr><td colspan="5">Lütfen bir lig seçin.</td></tr>`;
                    else if (tableBody) tableBody.innerHTML = `<tr><td colspan="10">Lütfen bir lig seçin.</td></tr>`; // Diğer tablolar için genel

                    if (matchList) matchList.innerHTML = '<li>Lütfen bir lig seçin.</li>';

                    if (loading) loading.style.display = 'none'; // Yükleniyor'u gizle
                    if (error) error.style.display = 'none'; // Hata'yı gizle
                 }
            });
            if (analyzeBtn) analyzeBtn.disabled = true; // Analiz butonunu devre dışı bırak
             hideAutoAnalysisStatus(); // Otomatik analiz durumunu gizle

             // Eğer aktif görünüm highlights/coupon değilse, standings'e dön
             if (currentView !== 'highlights' && currentView !== 'coupon') {
                  updateActiveView('standings');
             }
        }
    });

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
             if (isAutoAnalyzing && button.dataset.view !== currentView) {
                 alert("Otomatik analiz devam ederken sekme değiştirilemez.");
                 return;
             }
            const viewId = button.dataset.view;
            if (!button.classList.contains('active') && !button.disabled) {
                 updateActiveView(viewId);
            }
        });
    });

    if (clearHighlightsButton) clearHighlightsButton.addEventListener('click', clearHighlights);
    if (clearCouponButton) clearCouponButton.addEventListener('click', clearCoupon);

    if (analyzeUpcomingBtn) {
        analyzeUpcomingBtn.addEventListener('click', () => {
            if (selectedLeagueId && !isAutoAnalyzing) {
                analyzeUpcomingAndAddToCoupon(selectedLeagueId);
            } else if (isAutoAnalyzing) {
                showAutoAnalysisStatus("Analiz zaten devam ediyor...", "loading");
            } else {
                 showError('upcoming', 'Lütfen önce bir lig seçin.');
                  if (analyzeUpcomingBtn) analyzeUpcomingBtn.disabled = true;
            }
        });
    }
}

// --- Sayfa Yüklendiğinde Başlatma ---
document.addEventListener('DOMContentLoaded', () => {
    populateLeagueSelect();
    setupEventListeners();
    updateApiStatus('Bilinmiyor'); // Başlangıç durumu

    // Öne Çıkanlar ve Kupon butonları her zaman aktif olmalı
    const highlightButtonNav = document.querySelector('.nav-button[data-view="highlights"]');
    const couponButtonNav = document.querySelector('.nav-button[data-view="coupon"]');
    if(highlightButtonNav) highlightButtonNav.disabled = false;
    if(couponButtonNav) couponButtonNav.disabled = false;

    // Başlangıçta Puan Durumu aktif, lig seçili değilse mesaj göster
    updateActiveView('standings');
     const stTableBody = document.getElementById('standingsTable')?.querySelector('tbody');
     if (stTableBody && !selectedLeagueId) {
         stTableBody.innerHTML = `<tr><td colspan="12">Lütfen bir lig seçin.</td></tr>`;
     }
     // Diğer view'lar için de başlangıç mesajı (eğer ilk başta onlara geçilirse)
     const tsTableBody = document.getElementById('topscorersTable')?.querySelector('tbody');
      if (tsTableBody && !selectedLeagueId) tsTableBody.innerHTML = `<tr><td colspan="5">Lütfen bir lig seçin.</td></tr>`;
      const recentList = document.getElementById('recentMatchesList');
      if(recentList && !selectedLeagueId) recentList.innerHTML = `<li>Lütfen bir lig seçin.</li>`;
      const upcomingList = document.getElementById('upcomingMatchesList');
      if(upcomingList && !selectedLeagueId) upcomingList.innerHTML = `<li>Lütfen bir lig seçin.</li>`;

});