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

// 3. Render Sisters from JSON
function renderSisters(sisters) {
    listContainer.innerHTML = ""; 
    sisters.forEach((sister, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${sister.name}</td>
            <td><input type="checkbox" class="attendance-check"></td>
        `;
        listContainer.appendChild(row);
    });
    const checkboxes = document.querySelectorAll('.attendance-check');
    checkboxes.forEach(cb => cb.addEventListener('change', updateSummary));
    updateSummary();
}

// 4. Fetch Initial Data
fetch('sisters.json')
    .then(response => response.json())
    .then(data => renderSisters(data))
    .catch(err => console.error("Error loading JSON:", err));

// 5. Save Attendance
saveBtn.addEventListener('click', () => {
    const date = document.getElementById('meetingDate').value;
    const topic = document.getElementById('meetingTopic').value;
    
    if (!date) { alert("Please select a date!"); return; }

    const attendanceData = [];
    const rows = document.querySelectorAll('tbody tr');

    rows.forEach(row => {
        // FIX: row.cells[1] is the Name. row.cells[0] is the Number.
        const name = row.cells[1].textContent; 
        const isPresent = row.querySelector('.attendance-check').checked;
        attendanceData.push({ name, status: isPresent ? "Present" : "Absent" });
    });

    const record = { date, topic, attendance: attendanceData, status: 'active' };
    localStorage.setItem(`attendance_${date}`, JSON.stringify(record));
    
    alert(`Saved!`);
    loadHistory(); // Refresh the list immediately
});

// 6. Load History (ONLY ONE VERSION)
function loadHistory() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;
    historyList.innerHTML = ""; 

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('attendance_')) {
            const record = JSON.parse(localStorage.getItem(key));
            if (record.status === 'archived') continue; 

            const presentCount = record.attendance.filter(s => s.status === "Present").length;
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="history-info">
                    <span class="history-date">${record.date}</span>
                    <span class="history-topic">${record.topic || 'No Topic'}</span>
                </div>
                <div class="history-actions">
                    <span class="present-label">${presentCount} Present</span>
                    <div class="button-group">
                        <button class="view-btn" onclick="showRecord('${key}')">View</button>
                        <button class="delete-btn" onclick="deleteRecord('${key}')">Archive</button>
                    </div>
                </div>`;
            historyList.appendChild(li);
        }
    }
}

// 7. Show Details, Archive, Restore, Delete
function showRecord(key) {
    const record = JSON.parse(localStorage.getItem(key));
    const detailsCard = document.getElementById('detailsCard');
    
    document.getElementById('detailsTitle').textContent = `Attendance: ${record.date}`;
    document.getElementById('detailsTopic').textContent = record.topic || "None";
    
    const list = document.getElementById('detailsAttendanceList');
    list.innerHTML = ""; 
    
    record.attendance.forEach((sister, index) => {
        const item = document.createElement('li');
        
        // This shows: 1. Name: Status
        item.innerHTML = `
            <span class="sister-name"><strong>${index + 1}.</strong> ${sister.name}</span>
            <span class="sister-status" style="color: ${sister.status === "Present" ? "#27ae60" : "#e74c3c"}">
                ${sister.status}
            </span>
        `;
        list.appendChild(item);
    });
    
    detailsCard.style.display = 'block'; 
    window.scrollTo(0, 0); 
}

function deleteRecord(key) {
    if (confirm("Archive this record?")) {
        const record = JSON.parse(localStorage.getItem(key));
        record.status = 'archived';
        localStorage.setItem(key, JSON.stringify(record));
        loadHistory();
    }
}

// 8. Admin & Export
const adminBtn = document.getElementById('adminBtn');
adminBtn.addEventListener('click', () => {
    if (prompt("Password:") === "sisters123") {
        document.getElementById('archiveCard').style.display = 'block';
        loadArchive();
    } else { alert("Wrong!"); }
});

function loadArchive() {
    const archiveList = document.getElementById('archiveList');
    archiveList.innerHTML = "";
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('attendance_')) {
            const record = JSON.parse(localStorage.getItem(key));
            if (record.status === 'archived') {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${record.date} - ${record.topic}</span>
                    <button onclick="restoreRecord('${key}')">Restore</button>
                    <button onclick="permanentDelete('${key}')">Delete</button>`;
                archiveList.appendChild(li);
            }
        }
    }
}

function restoreRecord(key) {
    const record = JSON.parse(localStorage.getItem(key));
    record.status = 'active';
    localStorage.setItem(key, JSON.stringify(record));
    loadArchive(); loadHistory();
}

function permanentDelete(key) {
    if (confirm("Delete forever?")) { localStorage.removeItem(key); loadArchive(); }
}

// 9. Export
document.getElementById('exportBtn').addEventListener('click', () => {
    let csv = "Date,Topic,Name,Status\n";
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('attendance_')) {
            const rec = JSON.parse(localStorage.getItem(key));
            rec.attendance.forEach(s => { csv += `${rec.date},${rec.topic},${s.name},${s.status}\n`; });
        }
    }
    const link = document.createElement("a");
    link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
    link.download = "attendance.csv";
    link.click();
});

// Run History on start
loadHistory();