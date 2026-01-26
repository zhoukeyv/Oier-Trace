let staticData = null;
let studentData = [];
let selectedContest = null;
let selectedProvince = null;
let selectedSchool = null;
let conditions = [];

let queryMode = 'single';
let students = [];
let currentStudentData = {};
let editingStudentIndex = -1;

// 快速查询变量
let quickSelectedSchool = null;

let studentIndexes = {
    byName: new Map(),
    byGrade: new Map(),
    byContest: new Map(),
    bySchool: new Map(),
    byProvince: new Map()
};
let recordsCache = new Map();
let studentById = new Map();
let contestStudentIndex = new Map();
let schoolStudentIndex = new Map();
let provinceStudentIndex = new Map();
let gradeStudentIndex = new Map();
let allStudentIds = new Set();

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

        buildIndexes();

        document.getElementById('loadingIndicator').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');

        console.log(`加载了 ${staticData.contests.length} 个比赛和 ${staticData.schools.length} 所学校`);
        console.log(`加载了 ${studentData.length} 名学生数据`);
        console.log(`构建了索引，查询性能已优化`);

    } catch (error) {
        document.getElementById('loadingIndicator').innerHTML = 
            `<div class="error">数据加载失败: ${error.message}<br>请确保使用HTTP服务器访问（不要使用file://协议）</div>`;
    }
}

function buildIndexes() {
    console.time('构建索引耗时');
    
    studentIndexes.byName.clear();
    studentIndexes.byGrade.clear();
    studentIndexes.byContest.clear();
    studentIndexes.bySchool.clear();
    studentIndexes.byProvince.clear();
    recordsCache.clear();
    studentById.clear();
    contestStudentIndex.clear();
    schoolStudentIndex.clear();
    provinceStudentIndex.clear();
    gradeStudentIndex.clear();
    allStudentIds.clear();
    
    for (const student of studentData) {
        studentById.set(student.id, student);
        allStudentIds.add(student.id);
        
        // 支持多个学生使用相同简写
        if (!studentIndexes.byName.has(student.abbr)) {
            studentIndexes.byName.set(student.abbr, []);
        }
        studentIndexes.byName.get(student.abbr).push(student);
        
        if (!studentIndexes.byGrade.has(student.enroll_year)) {
            studentIndexes.byGrade.set(student.enroll_year, []);
        }
        studentIndexes.byGrade.get(student.enroll_year).push(student);
        if (!gradeStudentIndex.has(student.enroll_year)) {
            gradeStudentIndex.set(student.enroll_year, new Set());
        }
        gradeStudentIndex.get(student.enroll_year).add(student.id);
        
        const records = parseRecord(student.records);
        recordsCache.set(student.id, records);
        
        for (const record of records) {
            if (!studentIndexes.byContest.has(record.contest_id)) {
                studentIndexes.byContest.set(record.contest_id, []);
            }
            if (!studentIndexes.byContest.get(record.contest_id).includes(student)) {
                studentIndexes.byContest.get(record.contest_id).push(student);
            }
            if (!contestStudentIndex.has(record.contest_id)) {
                contestStudentIndex.set(record.contest_id, new Set());
            }
            contestStudentIndex.get(record.contest_id).add(student.id);
            
            if (!studentIndexes.bySchool.has(record.school_id)) {
                studentIndexes.bySchool.set(record.school_id, []);
            }
            if (!studentIndexes.bySchool.get(record.school_id).includes(student)) {
                studentIndexes.bySchool.get(record.school_id).push(student);
            }
            if (!schoolStudentIndex.has(record.school_id)) {
                schoolStudentIndex.set(record.school_id, new Set());
            }
            schoolStudentIndex.get(record.school_id).add(student.id);
            
            const school = staticData.schools[record.school_id];
            if (school && school[1]) {
                const province = school[1];
                if (!studentIndexes.byProvince.has(province)) {
                    studentIndexes.byProvince.set(province, []);
                }
                if (!studentIndexes.byProvince.get(province).includes(student)) {
                    studentIndexes.byProvince.get(province).push(student);
                }
                if (!provinceStudentIndex.has(province)) {
                    provinceStudentIndex.set(province, new Set());
                }
                provinceStudentIndex.get(province).add(student.id);
            }
        }
    }
    
    console.timeEnd('构建索引耗时');
    console.log(`索引统计: 姓名=${studentIndexes.byName.size}, 年级=${studentIndexes.byGrade.size}, 比赛=${studentIndexes.byContest.size}, 学校=${studentIndexes.bySchool.size}, 省份=${studentIndexes.byProvince.size}`);
    console.log(`额外索引: contestStudentIndex=${contestStudentIndex.size}, schoolStudentIndex=${schoolStudentIndex.size}, provinceStudentIndex=${provinceStudentIndex.size}`);
}

function setupEventListeners() {
    // 快速查询事件
    document.getElementById('quickSchoolSearch').addEventListener('input', (e) => {
        searchQuickSchools(e.target.value);
    });
    
    document.getElementById('quickQueryBtn').addEventListener('click', executeQuickQuery);
    
    // 选项卡切换
    document.getElementById('showAdvancedLink').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('quickSearchSection').classList.add('hidden');
        document.getElementById('advancedSearchSection').classList.remove('hidden');
    });
    
    document.getElementById('backToQuickBtn').addEventListener('click', () => {
        document.getElementById('advancedSearchSection').classList.add('hidden');
        document.getElementById('quickSearchSection').classList.remove('hidden');
    });
    
    // 高级查询事件
    document.querySelectorAll('input[name="queryMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            queryMode = e.target.value;
            updateQueryModeUI();
        });
    });

    document.getElementById('addStudentBtn').addEventListener('click', openStudentModal);

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
    document.getElementById('multiQueryBtn').addEventListener('click', executeQuery);
}

function updateQueryModeUI() {
    const singleSection = document.getElementById('singleStudentSection');
    const multiSection = document.getElementById('multiStudentSection');
    
    if (queryMode === 'single') {
        singleSection.classList.remove('hidden');
        multiSection.classList.add('hidden');
    } else {
        singleSection.classList.add('hidden');
        multiSection.classList.remove('hidden');
    }
}

function openStudentModal(index = -1) {
    editingStudentIndex = index;
    
    if (index >= 0) {
        currentStudentData = JSON.parse(JSON.stringify(students[index]));
    } else {
        currentStudentData = {
            conditions: [],
            province: null,
            school: null,
            grade: null,
            name: null
        };
    }

    const modal = createStudentModal();
    document.body.appendChild(modal);
    modal.classList.add('active');

    setupModalEventListeners();
}

function createStudentModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'studentModal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">${editingStudentIndex >= 0 ? '编辑学生' : '添加学生'}</h2>
                <button class="modal-close" onclick="closeStudentModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="section" style="margin-bottom: 16px;">
                    <div class="section-title">奖项条件（至少一个）</div>
                    <div class="section-content">
                        <div class="form-group">
                            <label>搜索比赛</label>
                            <input type="text" id="modalContestSearch" placeholder="输入比赛关键字">
                            <div id="modalContestResults" class="search-results hidden"></div>
                        </div>
                        
                        <div id="modalSelectedContestInfo" class="hidden">
                            <div class="form-row">
                                <div class="form-group">
                                    <label>选择奖项等级</label>
                                    <select id="modalAwardSelect">
                                        ${AWARD_OPTIONS.map(opt => 
                                            `<option value="${opt.value}">${opt.label}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>精确分数</label>
                                    <input type="number" id="modalScoreInput" placeholder="留空表示不限制分数" step="0.01">
                                </div>
                            </div>
                            <button class="secondary-btn" onclick="addModalCondition()">添加此奖项</button>
                        </div>
                        
                        <div id="modalConditionsList" style="margin-top: 16px;">
                            <div class="notice">
                                <span class="notice-icon">i</span>
                                <div class="notice-text">暂未添加任何奖项条件</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="sections-grid">
                    <div class="section">
                        <div class="section-title">省份（可选）</div>
                        <div class="section-content">
                            <div class="form-group">
                                <input type="text" id="modalProvinceSearch" placeholder="搜索省份">
                                <div id="modalProvinceResults" class="search-results hidden"></div>
                            </div>
                            <div id="modalSelectedProvince" class="hidden" style="margin-top: 8px; color: #4da6d6;"></div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">学校（可选）</div>
                        <div class="section-content">
                            <div class="form-group">
                                <input type="text" id="modalSchoolSearch" placeholder="搜索学校">
                                <div id="modalSchoolResults" class="search-results hidden"></div>
                            </div>
                            <div id="modalSelectedSchool" class="hidden" style="margin-top: 8px; color: #4da6d6;"></div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">年级（可选）</div>
                        <div class="section-content">
                            <div class="form-group">
                                <label>入学年份</label>
                                <input type="number" id="modalGradeInput" placeholder="如: 2019" min="2000" max="2030">
                            </div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">姓名简称（可选）</div>
                        <div class="section-content">
                            <div class="form-group">
                                <label>姓名简称</label>
                                <input type="text" id="modalNameInput" placeholder="如: zxw, lhx">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="modal-btn modal-btn-cancel" onclick="closeStudentModal()">取消</button>
                <button class="modal-btn modal-btn-primary" onclick="saveStudentData()">保存学生</button>
            </div>
        </div>
    `;
    
    setTimeout(() => {
        updateModalConditionsList();
        if (currentStudentData.province) {
            document.getElementById('modalProvinceSearch').value = currentStudentData.province;
            document.getElementById('modalSelectedProvince').textContent = `已选择: ${currentStudentData.province}`;
            document.getElementById('modalSelectedProvince').classList.remove('hidden');
        }
        if (currentStudentData.school) {
            const school = staticData.schools[currentStudentData.school];
            if (school) {
                document.getElementById('modalSchoolSearch').value = school[0];
                document.getElementById('modalSelectedSchool').textContent = `已选择: ${school[0]}`;
                document.getElementById('modalSelectedSchool').classList.remove('hidden');
            }
        }
        if (currentStudentData.grade) {
            document.getElementById('modalGradeInput').value = currentStudentData.grade;
        }
        if (currentStudentData.name) {
            document.getElementById('modalNameInput').value = currentStudentData.name;
        }
    }, 0);
    
    return modal;
}

function setupModalEventListeners() {
    document.getElementById('modalContestSearch').addEventListener('input', (e) => {
        searchModalContests(e.target.value);
    });
    
    document.getElementById('modalProvinceSearch').addEventListener('input', (e) => {
        searchModalProvinces(e.target.value);
    });
    
    document.getElementById('modalSchoolSearch').addEventListener('input', (e) => {
        searchModalSchools(e.target.value);
    });
}

function searchModalContests(keyword) {
    if (!keyword.trim()) {
        document.getElementById('modalContestResults').classList.add('hidden');
        return;
    }

    const results = staticData.contests
        .map((contest, idx) => ({ id: idx, ...contest }))
        .filter(contest => contest.name.toLowerCase().includes(keyword.toLowerCase()));

    const resultsDiv = document.getElementById('modalContestResults');
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="search-item">未找到匹配的比赛</div>';
        resultsDiv.classList.remove('hidden');
        return;
    }

    resultsDiv.innerHTML = results.slice(0, 20).map(contest => 
        `<div class="search-item" onclick="selectModalContest(${contest.id})">
            <strong>ID:${contest.id}</strong> - ${contest.name} <span style="color: #666;">(${contest.year}年)</span>
        </div>`
    ).join('');
    resultsDiv.classList.remove('hidden');
}

function selectModalContest(contestId) {
    selectedContest = { id: contestId, ...staticData.contests[contestId] };
    document.getElementById('modalContestSearch').value = selectedContest.name;
    document.getElementById('modalContestResults').classList.add('hidden');
    document.getElementById('modalSelectedContestInfo').classList.remove('hidden');
}

function addModalCondition() {
    if (!selectedContest) {
        alert('请先选择比赛');
        return;
    }

    const award = document.getElementById('modalAwardSelect').value;
    const score = document.getElementById('modalScoreInput').value.trim();

    const condition = {
        contest_id: selectedContest.id,
        contest_name: selectedContest.name,
        year: selectedContest.year
    };

    if (award) condition.award = award;
    if (score) condition.score = parseFloat(score);

    currentStudentData.conditions.push(condition);
    updateModalConditionsList();

    document.getElementById('modalContestSearch').value = '';
    document.getElementById('modalAwardSelect').value = '';
    document.getElementById('modalScoreInput').value = '';
    document.getElementById('modalSelectedContestInfo').classList.add('hidden');
    selectedContest = null;
}

function removeModalCondition(index) {
    currentStudentData.conditions.splice(index, 1);
    updateModalConditionsList();
}

function updateModalConditionsList() {
    const listDiv = document.getElementById('modalConditionsList');
    if (currentStudentData.conditions.length === 0) {
        listDiv.innerHTML = '<div class="notice"><span class="notice-icon">i</span><div class="notice-text">暂未添加任何奖项条件</div></div>';
        return;
    }

    listDiv.innerHTML = '<h4 style="margin-bottom: 12px; color: #0b6fa4;">已添加 ' + currentStudentData.conditions.length + ' 个奖项条件：</h4>' +
        currentStudentData.conditions.map((cond, idx) => {
            const awardBadge = cond.award ? getAwardBadgeHTML(cond.award) : '';
            
            return `<div class="condition-item">
                <div class="condition-content">
                    <div class="condition-title">
                        ${cond.contest_name}
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
                <button class="condition-remove" onclick="removeModalCondition(${idx})">删除</button>
            </div>`;
        }).join('');
}

function searchModalProvinces(keyword) {
    if (!keyword.trim()) {
        document.getElementById('modalProvinceResults').classList.add('hidden');
        return;
    }

    const provinces = [...new Set(staticData.schools.map(s => s[1]))];
    const results = provinces.filter(p => p.toLowerCase().includes(keyword.toLowerCase()));

    const resultsDiv = document.getElementById('modalProvinceResults');
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="search-item">未找到匹配的省份</div>';
        resultsDiv.classList.remove('hidden');
        return;
    }

    resultsDiv.innerHTML = results.map(province => 
        `<div class="search-item" onclick="selectModalProvince('${province.replace(/'/g, "\\'")}')">
            ${province}
        </div>`
    ).join('');
    resultsDiv.classList.remove('hidden');
}

function selectModalProvince(province) {
    currentStudentData.province = province;
    document.getElementById('modalProvinceSearch').value = province;
    document.getElementById('modalProvinceResults').classList.add('hidden');
    document.getElementById('modalSelectedProvince').textContent = `已选择: ${province}`;
    document.getElementById('modalSelectedProvince').classList.remove('hidden');
}

function searchModalSchools(keyword) {
    if (!keyword.trim()) {
        document.getElementById('modalSchoolResults').classList.add('hidden');
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

    const resultsDiv = document.getElementById('modalSchoolResults');
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="search-item">未找到匹配的学校</div>';
        resultsDiv.classList.remove('hidden');
        return;
    }

    resultsDiv.innerHTML = results.map(school => 
        `<div class="search-item" onclick="selectModalSchool(${school.id}, '${school.name.replace(/'/g, "\\'")}')">
            <strong>${school.name}</strong><br>
            <span style="color: #666; font-size: 0.9em;">${school.province} ${school.city}</span>
        </div>`
    ).join('');
    resultsDiv.classList.remove('hidden');
}

function selectModalSchool(schoolId, schoolName) {
    currentStudentData.school = schoolId;
    document.getElementById('modalSchoolSearch').value = schoolName;
    document.getElementById('modalSchoolResults').classList.add('hidden');
    document.getElementById('modalSelectedSchool').textContent = `已选择: ${schoolName}`;
    document.getElementById('modalSelectedSchool').classList.remove('hidden');
}

function saveStudentData() {
    if (currentStudentData.conditions.length === 0) {
        alert('请至少添加一个奖项条件');
        return;
    }

    const grade = document.getElementById('modalGradeInput').value.trim();
    const name = document.getElementById('modalNameInput').value.trim();
    
    if (grade) currentStudentData.grade = parseInt(grade);
    if (name) currentStudentData.name = name;
    
    if (editingStudentIndex >= 0) {
        students[editingStudentIndex] = currentStudentData;
    } else {
        students.push(currentStudentData);
    }
    
    updateStudentsList();
    closeStudentModal();
}

function closeStudentModal() {
    const modal = document.getElementById('studentModal');
    if (modal) {
        modal.remove();
    }
    selectedContest = null;
}

function updateStudentsList() {
    const listDiv = document.getElementById('studentsList');
    
    if (students.length === 0) {
        listDiv.innerHTML = '<div class="notice"><span class="notice-icon">i</span><div class="notice-text">暂未添加任何学生。点击下方按钮添加学生信息。</div></div>';
        return;
    }
    
    listDiv.innerHTML = students.map((student, idx) => {
        let desc = [];
        if (student.name) desc.push(`姓名: ${student.name}`);
        if (student.province) desc.push(`省份: ${student.province}`);
        if (student.school !== null) {
            const school = staticData.schools[student.school];
            if (school) desc.push(`学校: ${school[0]}`);
        }
        if (student.grade) desc.push(`年级: ${student.grade}`);
        
        return `
            <div class="student-item">
                <div class="student-item-header">
                    <div class="student-item-title">学生 ${idx + 1}</div>
                    <button class="student-item-remove" onclick="removeStudent(${idx})">删除</button>
                </div>
                <div class="student-conditions">
                    ${desc.length > 0 ? `<div class="student-conditions-title">筛选条件:</div>
                    <div class="student-condition-list">
                        ${desc.map(d => `<div class="student-condition-text">${d}</div>`).join('')}
                    </div>` : ''}
                    <div class="student-conditions-title">奖项条件 (${student.conditions.length}个):</div>
                    <div class="student-condition-list">
                        ${student.conditions.map(c => {
                            let text = `${c.contest_name} (${c.year})`;
                            if (c.award) text += ` - ${c.award}`;
                            if (c.score) text += ` - ${c.score}分`;
                            return `<div class="student-condition-text">${text}</div>`;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function removeStudent(index) {
    if (confirm('确定要删除这个学生吗?')) {
        students.splice(index, 1);
        updateStudentsList();
    }
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

function searchQuickSchools(keyword) {
    if (!keyword.trim()) {
        document.getElementById('quickSchoolResults').classList.add('hidden');
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

    const resultsDiv = document.getElementById('quickSchoolResults');
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="search-item" style="color: #999;">未找到匹配的学校</div>';
        resultsDiv.classList.remove('hidden');
        return;
    }

    resultsDiv.innerHTML = results.map(school => 
        `<div class="search-item" onclick="selectQuickSchool(${school.id}, '${school.name.replace(/'/g, "\\'")}')">            <strong>${school.name}</strong><br>
            <span style="color: #666; font-size: 0.9em;">${school.province} ${school.city}</span>
        </div>`
    ).join('');
    resultsDiv.classList.remove('hidden');
}

function selectQuickSchool(schoolId, schoolName) {
    quickSelectedSchool = schoolId;
    document.getElementById('quickSchoolSearch').value = schoolName;
    document.getElementById('quickSchoolResults').classList.add('hidden');
}

function executeQuickQuery() {
    const nameInput = document.getElementById('quickNameInput').value.trim();
    
    if (!nameInput) {
        alert('请输入姓名简称');
        return;
    }
    
    // 使用与高级查询相同的逻辑
    console.time('快速查询耗时');

    // 从姓名索引获取候选学生
    const candidateStudents = studentIndexes.byName.get(nameInput) || [];
    
    if (candidateStudents.length === 0) {
        displayQuickResults([]);
        console.timeEnd('快速查询耗时');
        return;
    }

    let finalResults = candidateStudents;

    // 按学校筛选（如果选择了学校）
    if (quickSelectedSchool !== null) {
        finalResults = candidateStudents.filter(student => {
            const records = recordsCache.get(student.id) || parseRecord(student.records);
            return records.some(record => record.school_id === quickSelectedSchool);
        });
    }

    console.timeEnd('快速查询耗时');
    console.log(`查询结果数: ${finalResults.length}`);

    displayQuickResults(finalResults);
}

function displayQuickResults(results) {
    const container = document.getElementById('quickResultsContainer');
    
    if (results.length === 0) {
        container.innerHTML = '<div class="error">未找到符合条件的学生</div>';
        container.classList.remove('hidden');
        return;
    }

    let html = `<div class="success" style="grid-column: 1 / -1;">找到 ${results.length} 名符合条件的学生</div>`;

    results.forEach(student => {
        // 获取奖项记录并从中提取学校和省份信息
        const records = recordsCache.get(student.id) || parseRecord(student.records);
        const studentSchools = new Set();
        const studentProvinces = new Set();
        const awards = [];
        
        records.forEach(record => {
            studentSchools.add(record.school_id);
            const school = staticData.schools[record.school_id];
            if (school && school[1]) {
                studentProvinces.add(school[1]);
            }
            
            const contest = staticData.contests[record.contest_id];
            const contestName = contest ? contest.name : `比赛ID:${record.contest_id}`;
            const awardName = getAwardName(record.award_type, record.award_level);
            const schoolName = school ? school[0] : `学校ID:${record.school_id}`;
            
            awards.push({
                year: contest ? contest.year : '',
                contest: contestName,
                award: awardName,
                score: record.score,
                rank: record.rank,
                school: schoolName
            });
        });

        // 转换学校ID为学校名称
        const schoolNames = Array.from(studentSchools).map(sid => {
            const school = staticData.schools[sid];
            return school ? school[0] : `学校ID:${sid}`;
        });
        
        const provinceNames = Array.from(studentProvinces);

        html += `
            <div class="result-card">
                <div class="result-header">
                    ${student.name} (${student.abbr})
                    <span style="color: #0b6fa4; font-size: 0.9em;">ID: ${student.id}</span>
                </div>
                <div class="result-info">
                    <strong>入学年份:</strong> ${student.enroll_year}<br>
                    ${schoolNames.length > 0 ? `<strong>学校:</strong> ${schoolNames.join(', ')}<br>` : ''}
                    ${provinceNames.length > 0 ? `<strong>省份:</strong> ${provinceNames.join(', ')}<br>` : ''}
                    <strong>获奖记录:</strong>
                </div>
        `;

        // 显示奖项记录
        awards.forEach(award => {
            html += `
                <div class="award-record">
                    <strong>[${award.year}]</strong> ${award.contest}<br>
                    <span style="color: #1e9155;">${award.award}</span> | 
                    分数: <strong>${award.score}</strong> | 
                    排名: <strong>${award.rank}</strong> | 
                    学校: ${award.school}
                </div>
            `;
        });

        html += '</div>';
    });

    container.innerHTML = html;
    container.classList.remove('hidden');
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

function intersectSets(a, b) {
    if (!a || a.size === 0) return new Set();
    if (!b || b.size === 0) return new Set();
    // 集合交集，优先遍历小集合
    const [small, large] = a.size < b.size ? [a, b] : [b, a];
    const result = new Set();
    for (const v of small) {
        if (large.has(v)) result.add(v);
    }
    return result;
}

function cloneSet(inputSet) {
    return inputSet ? new Set(inputSet) : new Set();
}

function getSet(map, key) {
    const s = map.get(key);
    return s ? s : new Set();
}

function executeQuery() {
    if (queryMode === 'multiple') {
        executeMultiStudentQuery();
    } else {
        executeSingleStudentQuery();
    }
}

function executeSingleStudentQuery() {
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
        console.time('单学生查询耗时');
        const results = [];

        let candidateStudents = [];
        if (nameFilter) {
            const students = studentIndexes.byName.get(nameFilter);
            candidateStudents = students ? students : [];
        } else if (conditions.length > 0) {
            const contestId = conditions[0].contest_id;
            candidateStudents = studentIndexes.byContest.get(contestId) || [];
        } else if (schoolFilter !== null) {
            candidateStudents = studentIndexes.bySchool.get(schoolFilter) || [];
        } else if (provinceFilter) {
            candidateStudents = studentIndexes.byProvince.get(provinceFilter) || [];
        } else if (gradeFilter && gradeFilter.mode === 'single') {
            candidateStudents = studentIndexes.byGrade.get(gradeFilter.value.toString()) || [];
        } else {
            candidateStudents = studentData;
        }
        
        console.log(`候选学生数: ${candidateStudents.length}/${studentData.length}`);

        for (const student of candidateStudents) {
            if (nameFilter && student.abbr !== nameFilter) continue;

            if (gradeFilter) {
                const enrollYear = parseInt(student.enroll_year);
                if (gradeFilter.mode === 'single') {
                    if (enrollYear !== gradeFilter.value) continue;
                } else if (gradeFilter.mode === 'range') {
                    if (enrollYear < gradeFilter.start || enrollYear > gradeFilter.end) continue;
                }
            }

            const records = recordsCache.get(student.id) || parseRecord(student.records);

            let allMatched = true;
            const matchedRecords = [];
            const studentSchools = new Set();
            const studentProvinces = new Set();

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

            if (provinceFilter && !studentProvinces.has(provinceFilter)) {
                allMatched = false;
            }

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
        
        console.timeEnd('单学生查询耗时');
        queryBtn.disabled = false;
        queryBtn.textContent = '开始查询';
    }, 100);
}

function executeMultiStudentQuery() {
    if (students.length === 0) {
        alert('请至少添加一个学生');
        return;
    }
    
    const queryBtn = document.getElementById('multiQueryBtn');
    queryBtn.disabled = true;
    queryBtn.textContent = '查询中...';
    
    const resultsContainer = document.getElementById('multiResultsContainer');
    resultsContainer.classList.remove('hidden');
    resultsContainer.innerHTML = `
        <div id="multiProgressWrapper" style="width: 100%; background: #f0f4f7; border-radius: 4px; overflow: hidden; height: 10px; margin-bottom: 8px; border: 1px solid #d3e1ea;">
            <div id="multiProgressBar" style="height: 100%; width: 0%; background: linear-gradient(90deg, #4da6d6, #1e9155);"></div>
        </div>
        <div id="multiProgressText" style="font-size: 12px; color: #0b6fa4; margin-bottom: 8px;">准备查询...</div>
        <div class="loading"><p>正在查询中...</p></div>
    `;
    
    const commonProvince = document.getElementById('commonProvince').checked;
    const commonSchool = document.getElementById('commonSchool').checked;
    const commonGrade = document.getElementById('commonGrade').checked;
    
    setTimeout(() => {
        console.time('多学生查询耗时');
        const progressBar = document.getElementById('multiProgressBar');
        const progressText = document.getElementById('multiProgressText');
        const totalStudents = students.length;
        const updateProgress = (doneCount, message) => {
            if (!progressBar || !progressText) return;
            const percent = Math.min(100, Math.round((doneCount / Math.max(1, totalStudents)) * 100));
            progressBar.style.width = `${percent}%`;
            progressText.textContent = `${percent}% - ${message}`;
        };
        updateProgress(0, '初始化候选集...');
        const studentMatches = [];
        
        for (let i = 0; i < students.length; i++) {
            const studentCond = students[i];
            const matches = [];

            let candidateIdSet = null;
            const intersect = (set) => {
                if (candidateIdSet === null) {
                    candidateIdSet = cloneSet(set);
                } else {
                    candidateIdSet = intersectSets(candidateIdSet, set);
                }
            };
            if (studentCond.name) {
                const students = studentIndexes.byName.get(studentCond.name);
                candidateIdSet = students ? new Set(students.map(s => s.id)) : new Set();
            }
            if (studentCond.grade) {
                intersect(getSet(gradeStudentIndex, studentCond.grade.toString()));
            }
            if (studentCond.school !== null) {
                intersect(getSet(schoolStudentIndex, studentCond.school));
            }
            if (studentCond.province) {
                intersect(getSet(provinceStudentIndex, studentCond.province));
            }
            if (studentCond.conditions.length > 0) {
                for (const condition of studentCond.conditions) {
                    intersect(getSet(contestStudentIndex, condition.contest_id));
                }
            }
            if (candidateIdSet === null) {
                candidateIdSet = cloneSet(allStudentIds);
            }
            const candidateStudents = Array.from(candidateIdSet).map(id => studentById.get(id)).filter(Boolean);
            console.log(`学生${i+1}候选数(经索引交集): ${candidateStudents.length}`);
            
            for (const student of candidateStudents) {
                if (studentCond.name && student.abbr !== studentCond.name) continue;

                if (studentCond.grade) {
                    const enrollYear = parseInt(student.enroll_year);
                    if (enrollYear !== studentCond.grade) continue;
                }

                const records = recordsCache.get(student.id) || parseRecord(student.records);

                let allConditionsMet = true;
                const matchedRecords = [];
                const studentSchools = new Set();
                const studentProvinces = new Set();
                const schoolProvincePairs = new Set();
                
                for (const condition of studentCond.conditions) {
                    let found = false;
                    
                    for (const record of records) {
                        if (matchAward(record, condition.contest_id, condition.award, condition.score)) {
                            const school = staticData.schools[record.school_id];
                            if (school) {
                                studentSchools.add(record.school_id);
                                studentProvinces.add(school[1]);
                                schoolProvincePairs.add(`${record.school_id}::${school[1]}`);
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
                        allConditionsMet = false;
                        break;
                    }
                }
                
                if (!allConditionsMet) continue;
                
                if (studentCond.province && !studentProvinces.has(studentCond.province)) {
                    continue;
                }
                if (studentCond.school !== null && !studentSchools.has(studentCond.school)) {
                    continue;
                }
                
                matches.push({
                    id: student.id,
                    name: student.name,
                    abbr: student.abbr,
                    enroll_year: student.enroll_year,
                    schools: Array.from(studentSchools),
                    provinces: Array.from(studentProvinces),
                    pairs: Array.from(schoolProvincePairs),
                    matched_awards: matchedRecords
                });
            }

            studentMatches.push(matches);
            updateProgress(i + 1, `学生${i + 1} 完成，候选 ${candidateStudents.length} ，匹配 ${matches.length}`);
        }
        const result = findValidCombinations(studentMatches, commonProvince, commonSchool, commonGrade, 100);
        
        displayMultiStudentResults(result, studentMatches, commonProvince, commonSchool, commonGrade);
        
        console.timeEnd('多学生查询耗时');
        const queryBtn = document.getElementById('multiQueryBtn');
        queryBtn.disabled = false;
        queryBtn.textContent = '开始查询';
    }, 100);
}

function findValidCombinations(studentMatches, commonProvince, commonSchool, commonGrade, maxResults = 100) {
    if (studentMatches.some(m => m.length === 0)) {
        return [];
    }

    let commonSchoolSet = null;
    let commonProvinceSet = null;

    if (commonSchool) {
        for (const matches of studentMatches) {
            const schoolSet = new Set();
            for (const m of matches) {
                for (const sid of m.schools) schoolSet.add(sid);
            }
            commonSchoolSet = commonSchoolSet === null ? schoolSet : intersectSets(commonSchoolSet, schoolSet);
            if (commonSchoolSet.size === 0) break;
        }
        if (!commonSchoolSet || commonSchoolSet.size === 0) {
            console.error('未找到共同学校交集');
            return { error: 'no_common_school', studentMatches };
        }
        console.log(`共同学校数: ${commonSchoolSet.size}, 学校列表:`, Array.from(commonSchoolSet).map(sid => staticData.schools[sid] ? staticData.schools[sid][0] : sid));
    }

    if (commonProvince) {
        for (const matches of studentMatches) {
            const provSet = new Set();
            for (const m of matches) {
                for (const p of m.provinces) provSet.add(p);
            }
            commonProvinceSet = commonProvinceSet === null ? provSet : intersectSets(commonProvinceSet, provSet);
            if (commonProvinceSet.size === 0) break;
        }
        if (!commonProvinceSet || commonProvinceSet.size === 0) {
            console.error('未找到共同省份交集');
            return { error: 'no_common_province', studentMatches };
        }
        console.log(`共同省份数: ${commonProvinceSet.size}, 省份列表:`, Array.from(commonProvinceSet));
    }

    if (commonSchoolSet) {
        for (let i = 0; i < studentMatches.length; i++) {
            studentMatches[i] = studentMatches[i].filter(m => m.schools.some(sid => commonSchoolSet.has(sid)));
        }
    }
    if (commonProvinceSet) {
        for (let i = 0; i < studentMatches.length; i++) {
            studentMatches[i] = studentMatches[i].filter(m => m.provinces.some(p => commonProvinceSet.has(p)));
        }
    }

    if (commonGrade) {
        const gradeSet = new Set(studentMatches[0].map(m => m.enroll_year));
        for (let i = 1; i < studentMatches.length; i++) {
            const s = new Set(studentMatches[i].map(m => m.enroll_year));
            for (const g of Array.from(gradeSet)) {
                if (!s.has(g)) gradeSet.delete(g);
            }
        }
        if (gradeSet.size === 0) {
            console.error('未找到共同年级交集');
            return { error: 'no_common_grade', studentMatches };
        }
        console.log(`共同年级数: ${gradeSet.size}, 年级列表:`, Array.from(gradeSet));
        for (let i = 0; i < studentMatches.length; i++) {
            studentMatches[i] = studentMatches[i].filter(m => gradeSet.has(m.enroll_year));
        }
    }

    console.log('过滤后各学生候选数:', studentMatches.map((m, i) => `学生${i+1}:${m.length}`).join(', '));
    
    const singleChoice = studentMatches.every(m => m.length === 1);
    if (singleChoice) {
        const combo = studentMatches.map(m => m[0]);
        const ids = combo.map(c => c.id);
        if (new Set(ids).size === ids.length) {
            const okSchool = !commonSchoolSet || combo.every(c => c.schools.some(s => commonSchoolSet.has(s)));
            const okProvince = !commonProvinceSet || combo.every(c => c.provinces.some(p => commonProvinceSet.has(p)));
            const okGrade = !commonGrade || new Set(combo.map(c => c.enroll_year)).size === 1;
            if (okSchool && okProvince && okGrade) {
                console.log('唯一组合直接返回');
                return [combo];
            }
        }
    }
    
    const totalCombinations = studentMatches.reduce((acc, m) => acc * m.length, 1);
    console.log(`理论组合数: ${totalCombinations}`);
    
    if (totalCombinations > 100000) {
        console.warn('组合数过大，启用激进剪枝策略');
        studentMatches.forEach((matches, idx) => {
            if (matches.length > 50) {
                console.warn(`学生${idx+1}候选数(${matches.length})过多，截断至50`);
                studentMatches[idx] = matches.slice(0, 50);
            }
        });
    }
    
    function generateCombinationsOptimized(arrays, maxResultsLocal = maxResults) {
        const results = [];
        const indices = new Array(arrays.length).fill(0);
        const lengths = arrays.map(arr => arr.length);

        const order = lengths
            .map((len, idx) => ({ len, idx }))
            .sort((a, b) => a.len - b.len)
            .map(o => o.idx);

        const nextIndices = () => {
            let carry = 1;
            for (let i = order.length - 1; i >= 0 && carry; i--) {
                const pos = order[i];
                indices[pos] += carry;
                if (indices[pos] >= lengths[pos]) {
                    indices[pos] = 0;
                } else {
                    carry = 0;
                }
            }
            return carry === 1;
        };
        
        while (true) {
            const combo = indices.map((idx, i) => arrays[i][idx]);
            
            const ids = combo.map(s => s.id);
            const uniqueIds = new Set(ids);
            if (uniqueIds.size === ids.length) {
                let valid = true;
                
                if (commonGrade) {
                    const grades = combo.map(s => s.enroll_year);
                    if (new Set(grades).size !== 1) valid = false;
                }
                
                if (valid && commonProvince) {
                    const provinceIntersection = combo.reduce((acc, student) => {
                        if (acc === null) return new Set(student.provinces);
                        return new Set([...acc].filter(p => student.provinces.includes(p)));
                    }, null);
                    if (!provinceIntersection || provinceIntersection.size === 0) valid = false;
                }
                
                if (valid && commonSchool) {
                    const schoolIntersection = combo.reduce((acc, student) => {
                        if (acc === null) return new Set(student.schools);
                        return new Set([...acc].filter(s => student.schools.includes(s)));
                    }, null);
                    if (!schoolIntersection || schoolIntersection.size === 0) valid = false;
                }
                
                if (valid) {
                    results.push(combo);
                    if (results.length >= maxResultsLocal) {
                        console.log(`达到最大结果数${maxResultsLocal}，停止搜索`);
                        return results;
                    }
                }
            }
            
            if (nextIndices()) break;
        }
        
        return results;
    }

    const getPairs = (match) => {
        if (match.pairs && match.pairs.length > 0) return match.pairs;
        const pairs = [];
        match.schools.forEach(s => match.provinces.forEach(p => pairs.push(`${s}::${p}`)));
        return pairs;
    };

    const groupAndCombine = (keys, projector) => {
        const aggregated = [];
        for (const key of keys) {
            const filtered = studentMatches.map(matches => matches.filter(m => projector(m).has(key)));
            if (filtered.some(f => f.length === 0)) continue;
            const part = generateCombinationsOptimized(filtered, Math.max(1, maxResults - aggregated.length));
            aggregated.push(...part);
            if (aggregated.length >= maxResults) break;
        }
        return aggregated;
    };

    if (commonSchool && commonProvince) {
        const pairKeys = new Set();
        for (const matches of studentMatches) {
            for (const m of matches) {
                getPairs(m).forEach(pair => pairKeys.add(pair));
            }
        }
        console.log(`共同(学校,省份)对数: ${pairKeys.size}`);
        const combos = groupAndCombine(pairKeys, m => new Set(getPairs(m)));
        console.log(`同校+同省分组求解，找到有效组合: ${combos.length}`);
        return { combinations: combos, groupBy: 'school_province', keys: Array.from(pairKeys) };
    }

    if (commonSchool) {
        const schoolKeys = commonSchoolSet || new Set();
        if (schoolKeys.size === 0) {
            for (const matches of studentMatches) {
                for (const m of matches) m.schools.forEach(s => schoolKeys.add(s));
            }
        }
        console.log(`共同学校数: ${schoolKeys.size}`);
        const combos = groupAndCombine(schoolKeys, m => new Set(m.schools));
        console.log(`同校分组求解，找到有效组合: ${combos.length}`);
        return { combinations: combos, groupBy: 'school', keys: Array.from(schoolKeys), schoolSet: schoolKeys };
    }

    if (commonProvince) {
        const provinceKeys = new Set();
        for (const matches of studentMatches) {
            for (const m of matches) m.provinces.forEach(p => provinceKeys.add(p));
        }
        const combos = groupAndCombine(provinceKeys, m => new Set(m.provinces));
        console.log(`同省分组求解，找到有效组合: ${combos.length}`);
        return combos;
    }

    const validCombinations = generateCombinationsOptimized(studentMatches, maxResults);
    console.log(`找到有效组合: ${validCombinations.length}`);
    return validCombinations;
}

function oldFilterCombination(combo, commonProvince, commonSchool, commonGrade) {
    return combo.filter(combo => {
        return true;
    });
}

function displayMultiStudentResults(result, allMatches, commonProvince, commonSchool, commonGrade) {
    const container = document.getElementById('multiResultsContainer');
    container.classList.remove('hidden');
    
    if (result && result.error) {
        displayDiagnosticInfo(result, allMatches, commonProvince, commonSchool, commonGrade);
        return;
    }
    
    let combinations = [];
    if (Array.isArray(result)) {
        combinations = result;
    } else if (result && result.combinations) {
        combinations = result.combinations;
        if (result.groupBy === 'school' && result.schoolSet) {
            displaySchoolGroupedResults(result, allMatches);
            return;
        }
    }
    
    if (allMatches.some(m => m.length === 0)) {
        const emptyIndex = allMatches.findIndex(m => m.length === 0);
        container.innerHTML = `
            <div class="error">
                <h3>学生 ${emptyIndex + 1} 未找到匹配结果</h3>
                <p>请尝试调整该学生的查询条件</p>
            </div>
        `;
        return;
    }
    
    if (combinations.length === 0) {
        const commonProvince = document.getElementById('commonProvince').checked;
        const commonSchool = document.getElementById('commonSchool').checked;
        const commonGrade = document.getElementById('commonGrade').checked;
        
        let hints = [];
        if (commonProvince) hints.push('同省份');
        if (commonSchool) hints.push('同学校');
        if (commonGrade) hints.push('同年级');
        
        container.innerHTML = `
            <div class="error">
                <h3>未找到满足条件的学生组合</h3>
                <p>每个学生都有匹配结果，但没有同时满足${hints.length > 0 ? hints.join('、') + '条件的' : ''}组合。</p>
                <ul style="margin-top: 10px; margin-left: 20px;">
                    ${allMatches.map((matches, i) => 
                        `<li>学生 ${i + 1}: 找到 ${matches.length} 个可能的匹配</li>`
                    ).join('')}
                </ul>
                <p style="margin-top: 10px;">建议: 尝试放宽共同条件或调整学生的筛选条件</p>
            </div>
        `;
        return;
    }
    
    if (combinations.length > 50) {
        container.innerHTML = `
            <div class="error">
                <h3>查询结果过多</h3>
                <p>找到 ${combinations.length} 个符合条件的学生组合，超过了50个的显示限制。</p>
                <p>请添加更多共同条件或为每个学生添加更具体的筛选条件。</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="success">
            <h3>找到 ${combinations.length} 个符合条件的学生组合</h3>
            <p style="margin-top: 5px;">以下是所有满足条件的学生组合</p>
        </div>
    `;
    
    combinations.forEach((combo, groupIdx) => {
        const commonFeatures = [];
        const provinceIntersection = combo.reduce((acc, student) => {
            if (acc === null) return new Set(student.provinces);
            return new Set([...acc].filter(p => student.provinces.includes(p)));
        }, null);
        if (provinceIntersection && provinceIntersection.size > 0) {
            commonFeatures.push(`省份: ${[...provinceIntersection].join(', ')}`);
        }
        const schoolIntersection = combo.reduce((acc, student) => {
            if (acc === null) return new Set(student.schools.map(sid => staticData.schools[sid] ? staticData.schools[sid][0] : sid));
            const currentSchools = student.schools.map(sid => staticData.schools[sid] ? staticData.schools[sid][0] : sid);
            return new Set([...acc].filter(s => currentSchools.includes(s)));
        }, null);
        if (schoolIntersection && schoolIntersection.size > 0) {
            commonFeatures.push(`学校: ${[...schoolIntersection].join(', ')}`);
        }
        const grades = [...new Set(combo.map(s => s.enroll_year))];
        if (grades.length === 1) {
            commonFeatures.push(`入学年份: ${grades[0]}`);
        }
        
        html += `
            <div class="multi-result-group">
                <div class="multi-result-header">组合 ${groupIdx + 1}</div>
                ${commonFeatures.length > 0 ? `
                    <div class="multi-result-common">
                        <div class="multi-result-common-title">共同特征:</div>
                        ${commonFeatures.map(f => `<div>${f}</div>`).join('')}
                    </div>
                ` : ''}
                <div class="multi-result-students">
                    ${combo.map((student, i) => `
                        <div class="result-card">
                            <div class="result-header">
                                学生 ${i + 1}: ${student.name} (${student.abbr})
                                <span style="color: #0b6fa4; font-size: 0.9em;">ID: ${student.id}</span>
                            </div>
                            <div class="result-info">
                                <strong>入学年份:</strong> ${student.enroll_year}<br>
                                ${student.provinces.length > 0 ? `<strong>省份:</strong> ${student.provinces.join(', ')}<br>` : ''}
                                ${student.schools.length > 0 ? `<strong>学校:</strong> ${student.schools.map(sid => {
                                    const school = staticData.schools[sid];
                                    return school ? school[0] : sid;
                                }).join(', ')}<br>` : ''}
                                <strong>获奖记录:</strong>
                            </div>
                            ${student.matched_awards.map(award => `
                                <div class="award-record">
                                    <strong>[${award.year}]</strong> ${award.contest}<br>
                                    <span style="color: #1e9155;">${award.award}</span> | 
                                    分数: <strong>${award.score}</strong> | 
                                    排名: <strong>${award.rank}</strong> | 
                                    学校: ${award.school}
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function displayDiagnosticInfo(result, allMatches, commonProvince, commonSchool, commonGrade) {
    const container = document.getElementById('multiResultsContainer');
    let html = `
        <div class="error">
            <h3>诊断信息：未找到满足所有条件的组合</h3>
    `;
    
    if (result.error === 'no_common_school') {
        html += `<p><strong>问题：</strong>没有找到所有学生的共同学校交集。</p>`;
        html += `<p><strong>说明：</strong>这里显示的是满足您设置的奖项条件后，各学生的学校列表。如果某个学生在其他比赛中有共同学校的数据，但那些比赛不在您的筛选条件中，这些学校就不会出现在这里。</p>`;
        html += `<p>各学生<strong>满足条件的比赛</strong>中的学校信息：</p><ul style="margin-left: 20px;">`;
        allMatches.forEach((matches, i) => {
            const schools = new Set();
            const schoolDetails = new Map();
            matches.forEach(m => {
                m.schools.forEach(s => {
                    schools.add(s);
                    if (!schoolDetails.has(s)) {
                        schoolDetails.set(s, []);
                    }
                    // 收集该学校对应的比赛信息
                    m.matched_awards.forEach(award => {
                        if (staticData.schools[s] && award.school === staticData.schools[s][0]) {
                            schoolDetails.get(s).push(award.contest);
                        }
                    });
                });
            });
            html += `<li><strong>学生 ${i+1}:</strong> `;
            const schoolList = Array.from(schools).map(sid => {
                const schoolName = staticData.schools[sid] ? staticData.schools[sid][0] : sid;
                const contests = schoolDetails.get(sid) || [];
                return contests.length > 0 ? `${schoolName} (${[...new Set(contests)].join(', ')})` : schoolName;
            });
            const displaySchools = schoolList.length > 5
                ? schoolList.slice(0, 5).join(', ') + ` 等${schoolList.length}个学校`
                : schoolList.join(', ');
            html += displaySchools;
            html += `</li>`;
        });
        html += `</ul>`;
        html += `<p style="margin-top: 10px; color: #d9534f;"><strong>提示：</strong>如果您知道这些学生在某个共同学校有成绩，请确保在每个学生的奖项条件中都包含了该学校对应的比赛。</p>`;
        
        // 添加详细的候选学生完整学校列表
        html += `<div style="margin-top: 20px; padding: 10px; background: #f8f9fa; border-radius: 4px;">`;
        html += `<p><strong>候选学生的完整学校列表（所有比赛）：</strong></p>`;
        allMatches.forEach((matches, i) => {
            if (matches.length > 0) {
                html += `<details style="margin: 10px 0;">`;
                html += `<summary style="cursor: pointer; color: #007bff;"><strong>学生 ${i+1} 的候选人 (${matches.length}个)</strong></summary>`;
                html += `<ul style="margin-left: 20px; margin-top: 8px;">`;
                matches.slice(0, 10).forEach(m => {
                    // 获取该学生的所有学校（从原始记录中）
                    const student = studentById.get(m.id);
                    if (student) {
                        const allRecords = recordsCache.get(student.id) || parseRecord(student.records);
                        const allSchools = new Set();
                        allRecords.forEach(rec => {
                            if (staticData.schools[rec.school_id]) {
                                allSchools.add(staticData.schools[rec.school_id][0]);
                            }
                        });
                        html += `<li>${m.name} (${m.abbr}) - ID: ${m.id}<br/>`;
                        html += `<span style="color: #666; font-size: 0.9em;">所有学校: ${Array.from(allSchools).join(', ')}</span></li>`;
                    }
                });
                if (matches.length > 10) {
                    html += `<li style="color: #999;">...还有 ${matches.length - 10} 个候选人</li>`;
                }
                html += `</ul></details>`;
            }
        });
        html += `</div>`;
    } else if (result.error === 'no_common_province') {
        html += `<p><strong>问题：</strong>没有找到所有学生的共同省份交集。</p>`;
        html += `<p>各学生的省份信息：</p><ul style="margin-left: 20px;">`;
        allMatches.forEach((matches, i) => {
            const provinces = new Set();
            matches.forEach(m => m.provinces.forEach(p => provinces.add(p)));
            const provinceArray = Array.from(provinces);
            const displayProvinces = provinceArray.length > 5 
                ? provinceArray.slice(0, 5).join(', ') + ` 等${provinceArray.length}个省份`
                : provinceArray.join(', ');
            html += `<li>学生 ${i+1}: ${displayProvinces}</li>`;
        });
        html += `</ul>`;
    } else if (result.error === 'no_common_grade') {
        html += `<p><strong>问题：</strong>没有找到所有学生的共同入学年份交集。</p>`;
    }
    
    html += `<p style="margin-top: 10px;">建议: 尝试放宽共同条件或调整学生的筛选条件</p>`;
    html += `</div>`;
    container.innerHTML = html;
}

function displaySchoolGroupedResults(result, allMatches) {
    const container = document.getElementById('multiResultsContainer');
    const schoolSet = result.schoolSet;
    
    let html = `
        <div class="success">
            <h3>找到 ${schoolSet.size} 所可能的共同学校</h3>
            <p style="margin-top: 5px;">以下按每所学校展示满足条件的学生组合</p>
        </div>
    `;
    
    for (const schoolId of schoolSet) {
        const schoolInfo = staticData.schools[schoolId];
        const schoolName = schoolInfo ? schoolInfo[0] : `学校ID:${schoolId}`;
        const province = schoolInfo ? schoolInfo[1] : '';
        const schoolMatches = allMatches.map(matches => 
            matches.filter(m => m.schools.includes(schoolId))
        );
        if (schoolMatches.some(m => m.length === 0)) continue;
        html += `
            <div class="multi-result-group" style="margin-bottom: 20px;">
                <div class="multi-result-header">${schoolName} (${province})</div>
                <div class="multi-result-students">
        `;
        schoolMatches.forEach((matches, i) => {
            html += `<div style="margin-bottom: 12px;">
                <strong>学生 ${i + 1} 在该校的可能匹配 (${matches.length}个):</strong>
                <ul style="margin-left: 20px; margin-top: 4px;">`;
            
            matches.slice(0, 5).forEach(student => {
                html += `<li>${student.name} (${student.abbr}) - ID: ${student.id} - 入学年份: ${student.enroll_year}</li>`;
            });
            
            if (matches.length > 5) {
                html += `<li style="color: #999;">...还有 ${matches.length - 5} 个匹配</li>`;
            }
            
            html += `</ul></div>`;
        });
        
        html += `</div></div>`;
    }
    
    if (schoolSet.size === 0) {
        html += `<div class="error"><p>未找到任何共同学校</p></div>`;
    }
    
    container.innerHTML = html;
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
