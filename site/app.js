let staticData = null;
let studentData = [];
let selectedContest = null;
let selectedProvince = null;
let selectedSchool = null;
let conditions = [];

const AWARD_OPTIONS = [
    { value: '', label: '不限制奖项' },
    { value: '金牌', label: '金牌', badge: 'gold' },
    { value: '银牌', label: '银牌', badge: 'silver' },
    { value: '铜牌', label: '铜牌', badge: 'bronze' },
    { value: '一等奖', label: '一等奖', badge: 'first' },
    { value: '二等奖', label: '二等奖', badge: 'second' },
    { value: '三等奖', label: '三等奖', badge: 'third' }
];

window.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupEventListeners();
    populateAwardSelect();
});

function populateAwardSelect() {
    const select = document.getElementById('awardSelect');
    select.innerHTML = AWARD_OPTIONS.map(opt => 
        `<option value="${opt.value}">${opt.label}</option>`
    ).join('');
}

async function loadData() {
    try {
        const staticResponse = await fetch('static.json');
        staticData = await staticResponse.json();

        const resultResponse = await fetch('result.txt');
        const resultText = await resultResponse.text();
        
        studentData = resultText.trim().split('\n').map(line => {
            const parts = line.split(',');
            if (parts.length < 7) return null;
            
            return {
                id: parts[0],
                abbr: parts[1],
                name: parts[2],
                gender: parts[3],
                enroll_year: parts[4],
                score: parts[5],
                avg_score: parts[6],
                records_count: parts[7] || '0',
                records: parts[8] || ''
            };
        }).filter(s => s !== null);

        document.getElementById('loadingIndicator').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');

        console.log(`加载了 ${staticData.contests.length} 个比赛和 ${staticData.schools.length} 所学校`);
        console.log(`加载了 ${studentData.length} 名学生数据`);

    } catch (error) {
        document.getElementById('loadingIndicator').innerHTML = 
            `<div class="error">数据加载失败: ${error.message}<br>请确保使用HTTP服务器访问（不要使用file://协议）</div>`;
    }
}

function setupEventListeners() {
    document.getElementById('contestSearch').addEventListener('input', (e) => {
        searchContests(e.target.value);
    });

    document.getElementById('addConditionBtn').addEventListener('click', addCondition);

    document.getElementById('useProvince').addEventListener('change', (e) => {
        document.getElementById('provinceSection').classList.toggle('hidden', !e.target.checked);
    });

    document.getElementById('provinceSearch').addEventListener('input', (e) => {
        searchProvinces(e.target.value);
    });

    document.getElementById('useSchool').addEventListener('change', (e) => {
        document.getElementById('schoolSection').classList.toggle('hidden', !e.target.checked);
    });

    document.getElementById('schoolSearch').addEventListener('input', (e) => {
        searchSchools(e.target.value);
    });

    document.getElementById('useGrade').addEventListener('change', (e) => {
        document.getElementById('gradeSection').classList.toggle('hidden', !e.target.checked);
    });

    document.getElementById('gradeMode').addEventListener('change', (e) => {
        const isSingle = e.target.value === 'single';
        document.getElementById('singleGradeSection').classList.toggle('hidden', !isSingle);
        document.getElementById('rangeGradeSection').classList.toggle('hidden', isSingle);
    });

    document.getElementById('useName').addEventListener('change', (e) => {
        document.getElementById('nameSection').classList.toggle('hidden', !e.target.checked);
    });

    document.getElementById('queryBtn').addEventListener('click', executeQuery);
}

function searchContests(keyword) {
    if (!keyword.trim()) {
        document.getElementById('contestResults').classList.add('hidden');
        return;
    }

    const results = staticData.contests
        .map((contest, idx) => ({ id: idx, ...contest }))
        .filter(contest => contest.name.toLowerCase().includes(keyword.toLowerCase()));

    const resultsDiv = document.getElementById('contestResults');
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="search-item">未找到匹配的比赛</div>';
        resultsDiv.classList.remove('hidden');
        return;
    }

    resultsDiv.innerHTML = results.slice(0, 20).map(contest => 
        `<div class="search-item" onclick="selectContest(${contest.id})">
            <strong>ID:${contest.id}</strong> - ${contest.name} <span style="color: #666;">(${contest.year}年)</span>
        </div>`
    ).join('');
    
    if (results.length > 20) {
        resultsDiv.innerHTML += `<div class="search-item" style="text-align: center; color: #999;">
            还有 ${results.length - 20} 个结果未显示，请输入更具体的关键字
        </div>`;
    }
    
    resultsDiv.classList.remove('hidden');
}

function selectContest(contestId) {
    selectedContest = {
        id: contestId,
        ...staticData.contests[contestId]
    };
    
    document.getElementById('contestSearch').value = selectedContest.name;
    document.getElementById('contestResults').classList.add('hidden');
    document.getElementById('selectedContestInfo').classList.remove('hidden');
}

function getAwardBadgeHTML(awardValue) {
    const award = AWARD_OPTIONS.find(opt => opt.value === awardValue);
    if (!award || !award.badge) return '';
    return `<span class="badge badge-${award.badge}">${award.label}</span>`;
}

function addCondition() {
    if (!selectedContest) {
        alert('请先选择比赛');
        return;
    }

    const award = document.getElementById('awardSelect').value;
    const score = document.getElementById('scoreInput').value.trim();

    const condition = {
        contest_id: selectedContest.id,
        contest_name: selectedContest.name,
        year: selectedContest.year
    };

    if (award) condition.award = award;
    if (score) condition.score = parseFloat(score);

    conditions.push(condition);
    updateConditionsList();

    document.getElementById('contestSearch').value = '';
    document.getElementById('awardSelect').value = '';
    document.getElementById('scoreInput').value = '';
    document.getElementById('selectedContestInfo').classList.add('hidden');
    selectedContest = null;
}

function updateConditionsList() {
    const listDiv = document.getElementById('conditionsList');
    if (conditions.length === 0) {
        listDiv.innerHTML = '<div class="notice"><span class="notice-icon" aria-hidden="true">i</span><div class="notice-text">暂未添加任何奖项条件（可选）</div></div>';
        return;
    }

    listDiv.innerHTML = '<h4 style="margin-bottom: 15px; color: #0b6fa4;">已添加 ' + conditions.length + ' 个奖项条件：</h4>' +
        conditions.map((cond, idx) => {
            const awardBadge = cond.award ? getAwardBadgeHTML(cond.award) : '';
            
            return `<div class="condition-item">
                <div class="condition-content">
                    <div class="condition-title">
                        条件 ${idx + 1}: ${cond.contest_name}
                    </div>
                    <div class="condition-details">
                        <div class="condition-detail-item">
                            年份: <strong>${cond.year}年</strong>
                        </div>
                        <div class="condition-detail-item">
                            奖项: ${awardBadge || '<span style="color: #999;">不限制</span>'}
                        </div>
                        ${cond.score ? `<div class="condition-detail-item">
                            分数: <strong>${cond.score}</strong>
                        </div>` : ''}
                    </div>
                </div>
                <button class="condition-remove" onclick="removeCondition(${idx})">删除</button>
            </div>`;
        }).join('');
}

function removeCondition(index) {
    conditions.splice(index, 1);
    updateConditionsList();
}

function searchProvinces(keyword) {
    if (!keyword.trim()) {
        document.getElementById('provinceResults').classList.add('hidden');
        return;
    }

    const provinces = [...new Set(staticData.schools.map(s => s[1]))];
    const results = provinces.filter(p => p.toLowerCase().includes(keyword.toLowerCase()));

    const resultsDiv = document.getElementById('provinceResults');
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="search-item">未找到匹配的省份</div>';
        resultsDiv.classList.remove('hidden');
        return;
    }

    resultsDiv.innerHTML = results.map(province => 
        `<div class="search-item" onclick="selectProvince('${province.replace(/'/g, "\\'")}')">
            ${province}
        </div>`
    ).join('');
    resultsDiv.classList.remove('hidden');
}

function selectProvince(province) {
    selectedProvince = province;
    document.getElementById('provinceSearch').value = province;
    document.getElementById('provinceResults').classList.add('hidden');
}

function searchSchools(keyword) {
    if (!keyword.trim()) {
        document.getElementById('schoolResults').classList.add('hidden');
        return;
    }

    const results = staticData.schools
        .map((school, idx) => ({
            id: idx,
            name: school[0],
            province: school[1],
            city: school[2]
        }))
        .filter(school => 
            school.name.toLowerCase().includes(keyword.toLowerCase()) ||
            school.province.toLowerCase().includes(keyword.toLowerCase()) ||
            school.city.toLowerCase().includes(keyword.toLowerCase())
        )
        .slice(0, 20);

    const resultsDiv = document.getElementById('schoolResults');
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="search-item">未找到匹配的学校</div>';
        resultsDiv.classList.remove('hidden');
        return;
    }

    resultsDiv.innerHTML = results.map(school => 
        `<div class="search-item" onclick="selectSchool(${school.id}, '${school.name.replace(/'/g, "\\'")}')">
            <strong>${school.name}</strong><br>
            <span style="color: #666; font-size: 0.9em;">${school.province} ${school.city}</span>
        </div>`
    ).join('');
    resultsDiv.classList.remove('hidden');
}

function selectSchool(schoolId, schoolName) {
    selectedSchool = schoolId;
    document.getElementById('schoolSearch').value = schoolName;
    document.getElementById('schoolResults').classList.add('hidden');
}

function parseRecord(recordStr) {
    if (!recordStr) return [];
    
    const records = [];
    for (const rec of recordStr.split('/')) {
        const parts = rec.split(':');
        if (parts.length >= 6) {
            try {
                records.push({
                    contest_id: parseInt(parts[0]),
                    school_id: parseInt(parts[1]),
                    score: parseFloat(parts[2]) || 0,
                    rank: parseInt(parts[3]) || 0,
                    award_type: parseInt(parts[4]),
                    award_level: parseInt(parts[5])
                });
            } catch (e) {
                continue;
            }
        }
    }
    return records;
}

function getAwardName(awardType, awardLevel) {
    if (awardLevel === 0) return "金牌";
    if (awardLevel === 1) return "银牌";
    if (awardLevel === 2) return "铜牌";
    if (awardLevel === 3) return "一等奖";
    if (awardLevel === 4) return "二等奖";
    if (awardLevel === 5) return "三等奖";
    return `奖项(level=${awardLevel})`;
}

function matchAward(record, contestId, award, score) {
    if (record.contest_id !== contestId) return false;
    
    if (score !== null && Math.abs(record.score - score) > 0.01) {
        return false;
    }
    
    if (award) {
        const awardName = getAwardName(record.award_type, record.award_level);
        if (!awardName.includes(award)) return false;
    }
    
    return true;
}

function executeQuery() {
    const provinceFilter = document.getElementById('useProvince').checked ? selectedProvince : null;
    const schoolFilter = document.getElementById('useSchool').checked ? selectedSchool : null;
    const nameFilter = document.getElementById('useName').checked ? 
        document.getElementById('nameInput').value.trim() : null;
    
    let gradeFilter = null;
    if (document.getElementById('useGrade').checked) {
        const gradeMode = document.getElementById('gradeMode').value;
        if (gradeMode === 'single') {
            const grade = document.getElementById('singleGradeInput').value.trim();
            if (grade) {
                gradeFilter = { mode: 'single', value: parseInt(grade) };
            }
        } else {
            const start = document.getElementById('gradeStartInput').value.trim();
            const end = document.getElementById('gradeEndInput').value.trim();
            if (start && end) {
                gradeFilter = { mode: 'range', start: parseInt(start), end: parseInt(end) };
            }
        }
    }

    const queryBtn = document.getElementById('queryBtn');
    queryBtn.disabled = true;
    queryBtn.textContent = '查询中...';

    setTimeout(() => {
        const results = [];

        for (const student of studentData) {
            if (nameFilter && student.abbr !== nameFilter) continue;

            if (gradeFilter) {
                const enrollYear = parseInt(student.enroll_year);
                if (gradeFilter.mode === 'single') {
                    if (enrollYear !== gradeFilter.value) continue;
                } else if (gradeFilter.mode === 'range') {
                    if (enrollYear < gradeFilter.start || enrollYear > gradeFilter.end) continue;
                }
            }

            const records = parseRecord(student.records);

            let allMatched = true;
            const matchedRecords = [];
            const studentSchools = new Set();
            const studentProvinces = new Set();

            // 如果没有奖项条件，收集所有学校和省份信息
            if (conditions.length === 0) {
                for (const record of records) {
                    const school = staticData.schools[record.school_id];
                    if (school) {
                        studentSchools.add(school[0]);
                        studentProvinces.add(school[1]);
                    }
                }
            }

            for (const condition of conditions) {
                let found = false;
                
                for (const record of records) {
                    if (matchAward(record, condition.contest_id, condition.award, condition.score)) {
                        const school = staticData.schools[record.school_id];
                        if (school) {
                            studentSchools.add(school[0]);
                            studentProvinces.add(school[1]);
                        }

                        found = true;
                        const contest = staticData.contests[record.contest_id];
                        matchedRecords.push({
                            contest: contest ? contest.name : '未知',
                            year: contest ? contest.year : 0,
                            score: record.score,
                            rank: record.rank,
                            award: getAwardName(record.award_type, record.award_level),
                            school: school ? school[0] : '未知'
                        });
                        break;
                    }
                }

                if (!found) {
                    allMatched = false;
                    break;
                }
            }

            // 省份过滤
            if (provinceFilter && !studentProvinces.has(provinceFilter)) {
                allMatched = false;
            }

            // 学校过滤
            if (schoolFilter !== null) {
                const hasSchool = records.some(r => r.school_id === schoolFilter);
                if (!hasSchool) allMatched = false;
            }

            if (allMatched && (conditions.length === 0 || matchedRecords.length === conditions.length)) {
                results.push({
                    id: student.id,
                    name: student.name,
                    abbr: student.abbr,
                    enroll_year: student.enroll_year,
                    schools: Array.from(studentSchools),
                    provinces: Array.from(studentProvinces),
                    matched_awards: matchedRecords
                });
            }
        }

        displayResults(results);
        
        queryBtn.disabled = false;
        queryBtn.textContent = '开始查询';
    }, 100);
}

function displayResults(results) {
    const container = document.getElementById('resultsContainer');
    container.classList.remove('hidden');

    if (results.length === 0) {
        container.innerHTML = `
            <div class="error">
                <h3>未找到符合条件的学生</h3>
                <p>请尝试调整查询条件，例如：</p>
                <ul style="margin-top: 10px; margin-left: 20px;">
                    <li>减少奖项条件数量</li>
                    <li>放宽奖项等级限制</li>
                    <li>取消省份或学校限制</li>
                </ul>
            </div>
        `;
        return;
    }

    if (results.length > 100) {
        container.innerHTML = `
            <div class="error">
                <h3>查询结果过多</h3>
                <p>找到 ${results.length} 名符合条件的学生，超过了100个的显示限制。</p>
                <p>请添加更多筛选条件以缩小查询范围，例如：</p>
                <ul style="margin-top: 10px; margin-left: 20px;">
                    <li>添加奖项条件</li>
                    <li>指定省份或学校</li>
                    <li>限定年级范围</li>
                    <li>输入姓名简称</li>
                </ul>
            </div>
        `;
        return;
    }

    let html = `
        <div class="success">
            <h3>找到 ${results.length} 名符合条件的学生</h3>
            <p style="margin-top: 5px;">以下学生满足所有查询条件</p>
        </div>
    `;

    results.forEach((r, i) => {
        html += `
            <div class="result-card">
                <div class="result-header">
                    【${i + 1}】${r.name} (${r.abbr}) 
                    <span style="color: #0b6fa4; font-size: 0.9em;">ID: ${r.id}</span>
                </div>
                <div class="result-info">
                    <strong>入学年份:</strong> ${r.enroll_year}<br>
                    ${r.schools.length > 0 ? `<strong>学校:</strong> ${r.schools.join(', ')}<br>` : ''}
                    ${r.provinces.length > 0 ? `<strong>省份:</strong> ${r.provinces.join(', ')}<br>` : ''}
                    <strong>获奖记录:</strong>
                </div>
                ${r.matched_awards.map(award => `
                    <div class="award-record">
                        <strong>[${award.year}]</strong> ${award.contest}<br>
                        <span style="color: #1e9155;">${award.award}</span> | 
                        分数: <strong>${award.score}</strong> | 
                        排名: <strong>${award.rank}</strong> | 
                        学校: ${award.school}
                    </div>
                `).join('')}
            </div>
        `;
    });

    container.innerHTML = html;
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
