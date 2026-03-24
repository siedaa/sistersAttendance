const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzAVEaAfp1WGBCDEMo620Wz6xFTA6_ozpmOfm1stjuvP8BjR2xiXKUCwZKNz09DsDoU/exec";
let attendanceCache = []; // This will store our data so we don't have to ask Google every time
// 1. Select the elements
const listContainer = document.querySelector('tbody'); 
const totalCountEl = document.getElementById('totalCount');
const presentCountEl = document.getElementById('presentCount');
const absentCountEl = document.getElementById('absentCount');
const saveBtn = document.getElementById('saveBtn');

// 2. Update Summary Numbers
function updateSummary() {
    const checkboxes = document.querySelectorAll('.attendance-check');
    const total = checkboxes.length;
    let present = 0;
    checkboxes.forEach(cb => { if (cb.checked) present++; });
    totalCountEl.textContent = total;
    presentCountEl.textContent = present;
    absentCountEl.textContent = total - present;
}
// displaying sisters name + poping up attendance percentage 
// 1. Render the table (ID-BASED VERSION)
function renderSisters(sisters) {
    listContainer.innerHTML = ""; 
    sisters.forEach((sister, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td class="clickable-name" 
                onmousemove="moveStatsPopup(event)"
                onmouseenter="showStatsPopup(event, ${sister.id})" 
                onmouseleave="hideStatsPopup()">
                ${sister.name}
            </td>
            <td>
                <input type="checkbox" class="attendance-check" data-id="${sister.id}">
            </td>
        `;
        listContainer.appendChild(row);
    });
    
    const checkboxes = document.querySelectorAll('.attendance-check');
    checkboxes.forEach(cb => cb.addEventListener('change', updateSummary));
    updateSummary();
}

// 2. Logic for the Tooltip (OUTSIDE renderSisters)
function showStatsPopup(event, name) {
    const tooltip = document.getElementById('statsTooltip');
    if (!tooltip) return;

    // Use the cached data (make sure attendanceCache is updated in loadHistory)
    const totalMeetings = attendanceCache.length;
    const attended = attendanceCache.filter(record => 
        record.attendance.some(s => s.name === name && s.status === "Present")
    ).length;
    
    const pct = totalMeetings > 0 ? Math.round((attended / totalMeetings) * 100) : 0;

    // Color code the percentage for a "Quick View"
    let color = pct >= 80 ? '#27ae60' : (pct >= 50 ? '#f1c40f' : '#e74c3c');

    tooltip.innerHTML = `
        <div style="border-left: 4px solid ${color}; padding-left: 8px;">
            <strong style="color:white">${name}</strong><br>
            <span style="color:${color}; font-weight:bold;">${pct}% Consistent</span><br>
            <small style="color:#bdc3c7">${attended} / ${totalMeetings} Meetings</small>
        </div>
    `;
    
    tooltip.style.display = 'block';
    moveStatsPopup(event); // Position it immediately
}

// 3. Keep it following the mouse
function moveStatsPopup(event) {
    const tooltip = document.getElementById('statsTooltip');
    if (tooltip.style.display === 'block') {
        tooltip.style.left = (event.clientX + 15) + 'px';
        tooltip.style.top = (event.clientY + 15) + 'px';
    }
}

// 4. Hide it
function hideStatsPopup() {
    const tooltip = document.getElementById('statsTooltip');
    if (tooltip) tooltip.style.display = 'none';
}

// 4. Fetch Initial Sisters List
fetch('sisters.json')
    .then(response => response.json())
    .then(data => renderSisters(data))
    .catch(err => console.error("Error loading JSON:", err));

// 5. Save Attendance
// 5. Save Attendance (ID-BASED VERSION)
saveBtn.addEventListener('click', async () => {
    const date = document.getElementById('meetingDate').value;
    const topic = document.getElementById('meetingTopic').value;
    
    if (!date) { alert("Please select a date!"); return; }

    const attendanceData = [];
    const rows = document.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const checkbox = row.querySelector('.attendance-check');
        // We get the ID from the 'data-id' attribute we added earlier
        const id = parseInt(checkbox.getAttribute('data-id')); 
        const isPresent = checkbox.checked;
        
        attendanceData.push({ 
            id: id, 
            status: isPresent ? "Present" : "Absent" 
        });
    });

    const record = { 
        date: date, 
        topic: topic, 
        attendance: attendanceData, 
        status: 'active' 
    };

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', 
            body: JSON.stringify(record)
        });
        
        alert(`Saved successfully!`);
        document.getElementById('meetingTopic').value = "";
        
        // Clear checkboxes and summary
        document.querySelectorAll('.attendance-check').forEach(cb => cb.checked = false);
        updateSummary(); 
        
        loadHistory(); // Reload the list
    } catch (err) {
        alert("Failed to save.");
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Attendance";
    }

    // This clears all checkboxes after a successful save
document.querySelectorAll('.attendance-check').forEach(cb => cb.checked = false);
updateSummary(); // Resets the "Total Present: 0" count at the bottom
}

);

// 6. Archive Action (Moves from History to Admin Archive)
async function archiveRecord(date, topic) {
    if (!confirm("Move this record to Admin Archive?")) return;
    
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: 'archive', date: date, topic: topic })
        });
        alert("Moved to Archive!");
        loadHistory(); 
    } catch (err) { alert("Archive failed."); }
}

// 7. Delete Action (ONLY for Admin Archive - Permanently removes from Sheet)
async function deleteRecord(date, topic) {
    if (!confirm(`PERMANENTLY DELETE from Google Sheets? This cannot be undone.`)) return;

    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: 'delete', date: date, topic: topic })
        });
        alert("Record permanently deleted!");
        loadHistory(); 
    } catch (err) { alert("Delete failed."); }
}

// 8. Load History & Archive (Separated by status)
async function loadHistory() {
    const historyList = document.getElementById('historyList');
    const archiveList = document.getElementById('archiveList');
    if (!historyList || !archiveList) return;

    historyList.innerHTML = "<li>Loading records...</li>"; 
    archiveList.innerHTML = "<li>Loading archive...</li>";

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const allRecords = await response.json();
        
        // --- FIXED LINE BELOW ---
        // We use 'allRecords' because that is what you named the JSON result
        attendanceCache = allRecords; 
        
        console.log("Attendance Cache Updated:", attendanceCache.length, "records");

        historyList.innerHTML = ""; 
        archiveList.innerHTML = "";

        // We use a copy for reversing so we don't flip the original cache
        [...allRecords].reverse().forEach((record) => {
            const presentCount = record.attendance.filter(s => s.status === "Present").length;
            const li = document.createElement('li');
            const recordString = JSON.stringify(record).replace(/'/g, "&apos;");

            if (record.status === 'active') {
                li.innerHTML = `
                    <div class="history-info">
                        <span class="history-date">${record.date}</span>
                        <span class="history-topic">${record.topic || 'No Topic'}</span>
                    </div>
                    <div class="history-actions">
                        <span class="present-label">${presentCount} Present</span>
                        <div class="button-group">
                            <button class="view-btn" onclick='showSharedRecord(${recordString})'>View</button>
                            <button class="archive-btn" onclick="archiveRecord('${record.date}', '${record.topic}')">Archive</button>
                        </div>
                    </div>`;
                historyList.appendChild(li);
           } else {
    // ADD TO ADMIN ARCHIVE with a Restore Button
    li.innerHTML = `
        <div class="history-info">
            <span class="history-date">${record.date}</span>
            <span class="history-topic" style="color: #7f8c8d;">${record.topic || 'No Topic'} (Archived)</span>
        </div>
        <div class="history-actions">
            <div class="button-group">
                <button class="view-btn" style="background:#2980b9" onclick="restoreRecord('${record.date}', '${record.topic}')">Restore</button>
                <button class="delete-btn" style="background:#c0392b" onclick="deleteRecord('${record.date}', '${record.topic}')">Delete</button>
            </div>
        </div>`;
    archiveList.appendChild(li);
}
        });
    } catch (err) {
        console.error(err);
        historyList.innerHTML = "<li>Error loading records.</li>";
    }
}
//restore record function from admin pannel to saved history (basiclly fixing the status in google sheet)
async function restoreRecord(date, topic) {
    if (!confirm(`Restore meeting from ${date}?`)) return;

    // Use URLSearchParams to avoid the "Internet/CORS" error
    const params = new URLSearchParams({
        action: 'updateStatus',
        date: date,
        topic: topic,
        newStatus: 'active'
    });

    try {
        // We add the params to the end of the URL
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`, {
            method: 'GET' // Changing to GET is much more stable for Google Scripts
        });

        const result = await response.text();
        
        if (result.includes("Success")) {
            alert("✅ Meeting restored!");
            await loadHistory(); 
        } else {
            alert("Server Error: " + result);
        }
    } catch (error) {
        console.error("Connection error:", error);
        alert("Still having connection issues. Check your Script URL!");
    }
}

// 9. Show Details
function showSharedRecord(record) {
    const detailsCard = document.getElementById('detailsCard');
    document.getElementById('detailsTitle').textContent = `Attendance: ${record.date}`;
    document.getElementById('detailsTopic').textContent = record.topic || "None";
    
    const list = document.getElementById('detailsAttendanceList');
    list.innerHTML = ""; 
    
    record.attendance.forEach((item, index) => {
        // LOOKUP: Find the name in your sisterList using the ID from the record
        const sisterInfo = sisterList.find(s => s.id === item.id);
        const displayName = sisterInfo ? sisterInfo.name : "Unknown Member";

        const li = document.createElement('li');
        li.innerHTML = `
            <span class="sister-name"><strong>${index + 1}.</strong> ${displayName}</span>
            <span class="sister-status" style="color: ${item.status === "Present" ? "#27ae60" : "#e74c3c"}">
                ${item.status}
            </span>
        `;
        list.appendChild(li);
    });
    
    detailsCard.style.display = 'block'; 
    window.scrollTo(0, 0); 
}

// Admin Panel Toggle
document.getElementById('adminBtn').addEventListener('click', () => {
    const pass = prompt("Enter Admin Password:");
    if (pass === "sisters123") {
        document.getElementById('archiveCard').style.display = 'block';
    } else {
        alert("Incorrect password.");
    }
});

// Helper to calculate a sister's attendance percentage
async function showQuickStats(name) {
    // Show a "loading" alert or toast if you want
    console.log("Fetching stats for: " + name);
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const data = await response.json();
        
        let totalMeetings = data.length;
        // Count how many times this sister was "Present"
        let attended = data.filter(record => 
            record.attendance.some(s => s.name === name && s.status === "Present")
        ).length;

        let percentage = totalMeetings > 0 ? Math.round((attended / totalMeetings) * 100) : 0;
        
        alert(`📊 Attendance Profile: ${name}\n\n` +
              `Percentage: ${percentage}%\n` +
              `Attended: ${attended} out of ${totalMeetings} meetings.`);
              
    } catch (e) {
        alert("Could not load stats. Check connection.");
    }
}

// attendamce adminstrative bar :

document.getElementById('showLeaderboardBtn').addEventListener('click', function() {
    const container = document.getElementById('leaderboardContainer');
    
    // Toggle visibility
    if (container.style.display === 'block') {
        container.style.display = 'none';
        this.textContent = "📊 View Sisters Performance Rank";
        return;
    }

    this.textContent = "Hide Performance Rank";
    container.style.display = 'block';
    container.innerHTML = "<p style='text-align:center;'>Calculating Ranks...</p>";

    if (attendanceCache.length === 0) {
        container.innerHTML = "<p style='color:red;'>No data available. Please load history first.</p>";
        return;
    }

    // 1. Get all unique sister names from the latest record
    const sisters = attendanceCache[0].attendance.map(s => s.name);
    let leaderData = [];

    // 2. Calculate stats for everyone
    sisters.forEach(name => {
        const total = attendanceCache.length;
        const attended = attendanceCache.filter(r => 
            r.attendance.some(s => s.name === name && s.status === "Present")
        ).length;
        const pct = Math.round((attended / total) * 100);
        leaderData.push({ name, pct, attended, total });
    });

    // 3. Sort by percentage (Highest first)
    leaderData.sort((a, b) => b.pct - a.pct);

    // 4. Generate HTML with Progress Bars
    let html = `<h4 style="margin-top:0; color:#2c3e50;">Sisters Ranking (${attendanceCache.length} Meetings Total)</h4>`;
    
    leaderData.forEach((s, index) => {
        // Color logic: Green for 80%+, Yellow for 50%+, Red for below 50%
        let barColor = s.pct >= 80 ? '#27ae60' : (s.pct >= 50 ? '#f1c40f' : '#e74c3c');
        let badge = index === 0 ? '👑' : (index === 1 ? '⭐' : (index === 2 ? '✨' : ''));

        html += `
            <div style="margin-bottom: 12px; border-bottom: 1px solid #f1f1f1; padding-bottom: 5px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.9em;">
                    <span><strong>${index + 1}.</strong> ${badge} ${s.name}</span>
                    <span style="font-weight:bold; color:${barColor}">${s.pct}%</span>
                </div>
                <div style="background:#eee; height:8px; border-radius:4px; overflow:hidden;">
                    <div style="background:${barColor}; width:${s.pct}%; height:100%; transition: width 0.5s;"></div>
                </div>
                <small style="color:#7f8c8d; font-size:0.75em;">Attended ${s.attended} meetings</small>
            </div>
        `;
    });
// refresh button in admin archive logic: 
// 1. MASTER SYNC FUNCTION
async function performSync(isAuto = false) {
    const statusText = document.getElementById('lastUpdated');
    const syncBtn = document.getElementById('syncBtn');
    const syncIcon = document.getElementById('syncIcon');

    if (!syncIcon || !statusText) return;

    // Start Animation & UI Feedback
    statusText.textContent = isAuto ? "Auto-syncing..." : "Syncing...";
    syncIcon.style.transition = "transform 1s ease-in-out";
    syncIcon.style.transform = "rotate(360deg)";
    syncBtn.style.opacity = "0.5";
    syncBtn.style.pointerEvents = "none"; 

    try {
        // Fetch data from Google
        await loadHistory(); 

        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        statusText.textContent = (isAuto ? "Auto: " : "Synced: ") + timeString;
        statusText.style.color = "#27ae60"; // Green for success
        
        setTimeout(() => { statusText.style.color = "#95a5a6"; }, 3000);

    } catch (err) {
        console.error("Sync Error:", err);
        statusText.textContent = "Sync Failed";
        statusText.style.color = "#e74c3c"; // Red for error
    } finally {
        // Reset Icon and Button so it can be used again
        setTimeout(() => {
            syncIcon.style.transition = "none";
            syncIcon.style.transform = "rotate(0deg)";
            syncBtn.style.opacity = "1";
            syncBtn.style.pointerEvents = "auto";
        }, 1000);
    }
}

// 2. EVENT LISTENERS
// Manual Sync Click
document.getElementById('syncBtn').addEventListener('click', () => performSync(false));

// Auto-Sync (Every 5 minutes)
setInterval(() => performSync(true), 300000);
    container.innerHTML = html;
});

window.onload = () => {
    // 1. Check if the names from sisters.js are available
    if (typeof sisterList !== 'undefined') {
        renderSisters(sisterList); // This makes the names visible
        console.log("Names loaded from sisters.js");
    } else {
        console.error("sisters.js not found! Check your HTML script tags.");
    }

    // 2. Then load the history from Google
    loadHistory();
};
















// --- COMBINED FILTERED REPORT LOGIC ---
document.getElementById('printFilteredBtn').addEventListener('click', async () => {
    const fromDate = document.getElementById('filterDateFrom').value;
    const toDate = document.getElementById('filterDateTo').value;
    const topicSearch = document.getElementById('filterTopic').value.toLowerCase();
    const btn = document.getElementById('printFilteredBtn');

    try {
        btn.textContent = "Processing...";
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const data = await response.json();

        // 1. Filter the data based on your inputs
        let filteredData = data.filter(record => {
            const dateMatch = (!fromDate || record.date >= fromDate) && (!toDate || record.date <= toDate);
            const topicMatch = !topicSearch || (record.topic && record.topic.toLowerCase().includes(topicSearch));
            return dateMatch && topicMatch;
        });

        if (filteredData.length === 0) {
            alert("No records found for the selected filters!");
            btn.textContent = "Print Filtered PDF";
            return;
        }

        // 2. Open the print window
        const printWindow = window.open('', '_blank');
        
        let reportHtml = `
            <html>
            <head>
                <title>Attendance Report</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #2c3e50; }
                    .main-header { text-align: center; border-bottom: 3px solid #8e44ad; padding-bottom: 10px; margin-bottom: 30px; }
                    .meeting-block { margin-bottom: 40px; page-break-inside: avoid; border: 1px solid #eee; padding: 20px; border-radius: 8px; }
                    .meeting-title { background: #f8f9fa; padding: 10px; margin: -20px -20px 15px -20px; border-radius: 8px 8px 0 0; border-bottom: 1px solid #ddd; }
                    .attendance-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 0.9em; }
                    .sister-entry { display: flex; justify-content: space-between; padding: 4px; border-bottom: 1px solid #f1f1f1; }
                    .present { color: #27ae60; font-weight: bold; }
                    .absent { color: #e74c3c; }
                </style>
            </head>
            <body>
                <div class="main-header">
                    <h1>Sisters Attendance Report</h1>
                    <p>${fromDate ? 'From: ' + fromDate : ''} ${toDate ? ' To: ' + toDate : ''}</p>
                </div>`;

        filteredData.forEach(record => {
            const presentCount = record.attendance.filter(s => s.status === "Present").length;
            reportHtml += `
                <div class="meeting-block">
                    <div class="meeting-title">
                        <h3 style="margin:0;">${record.date}</h3>
                        <p style="margin:5px 0 0 0;"><strong>Topic:</strong> ${record.topic || 'N/A'}</p>
                        <small>Present: ${presentCount} | Absent: ${record.attendance.length - presentCount}</small>
                    </div>
                    <div class="attendance-grid">`;

            record.attendance.forEach((sister, idx) => {
                reportHtml += `
                    <div class="sister-entry">
                        <span>${idx + 1}. ${sister.name}</span>
                        <span class="${sister.status === 'Present' ? 'present' : 'absent'}">${sister.status}</span>
                    </div>`;
            });
            reportHtml += `</div></div>`;
        });

        reportHtml += `</body></html>`;
        printWindow.document.write(reportHtml);
        printWindow.document.close();
        printWindow.onload = () => { printWindow.print(); };

    } catch (err) {
        console.error(err);
        alert("Error generating report.");
    } finally {
        btn.textContent = "Print Filtered PDF";
    }
});

document.getElementById('exportBtn').addEventListener('click', async () => {
    const response = await fetch(GOOGLE_SCRIPT_URL);
    const data = await response.json();
    let csv = "Date,Topic,Name,Status\n";
    data.forEach(r => r.attendance.forEach(s => {
        csv += `${r.date},${r.topic || ''},${s.name},${s.status}\n`;
    }));
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'attendance_backup.csv';
    a.click();
});

// signautre in inspect 

console.log(
    "%c System Crafted by siedaa Maha fatima %c 2026 ",
    "color: white; background: #2c3e50; padding: 5px; border-radius: 3px 0 0 3px; font-weight: bold;",
    "color: #2c3e50; background: #ecf0f1; padding: 5px; border-radius: 0 3px 3px 0; font-weight: bold;"
);
