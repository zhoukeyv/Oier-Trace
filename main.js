/**
 * OIerDb Main Application
 * 调用 sql.js 提供的接口实现所有业务功能
 */

// 应用状态
let selectedContest = null;
let selectedProvince = null;
let selectedSchool = null;
let conditions = [];
let queryMode = 'single';
let students = [];
let currentStudentData = {};
let editingStudentIndex = -1;
let quickSelectedSchool = null;

// 结果渲染器
let resultRenderer = null;

// 奖项选项配置
const AWARD_OPTIONS = [
    { value: '', label: '不限制奖项' },
    { value: '金牌', label: '金牌', badge: 'gold' },
    { value: '银牌', label: '银牌', badge: 'silver' },
    { value: '铜牌', label: '铜牌', badge: 'bronze' },
    { value: '一等奖', label: '一等奖', badge: 'first' },
    { value: '二等奖', label: '二等奖', badge: 'second' },
    { value: '三等奖', label: '三等奖', badge: 'third' }
];

// ============= 初始化 =============

window.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupEventListeners();
    populateAwardSelect();
});

async function loadData() {
    try {
        // 进度更新回调
        const onProgress = (percent, detail) => {
            const progressFill = document.getElementById('progressFill');
            const progressPercent = document.getElementById('progressPercent');
            const progressDetail = document.getElementById('progressDetail');
            
            if (progressFill) progressFill.style.width = percent + '%';
            if (progressPercent) progressPercent.textContent = Math.round(percent) + '%';
            if (progressDetail) progressDetail.textContent = detail;
        };
        
        await oierDb.initialize(onProgress);
        
        // 初始化结果渲染器
        resultRenderer = new ResultCardRenderer(oierDb);
        resultRenderer.init();
        window.resultRenderer = resultRenderer;
        
        document.getElementById('loadingIndicator').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
        
        const staticData = oierDb.getStatic();
        console。log(`加载了 ${staticData.contests.length} 个比赛和 ${staticData.schools.length} 所学校`);
        console.log(`加载了 ${oierDb.studentData.length} 名学生数据`);
        console.log(`构建了索引，查询性能已优化`);
    } catch (error) {
        document.getElementById('loadingIndicator').innerHTML = 
            `<div class="error">数据加载失败: ${error.message}<br>请确保使用HTTP服务器访问（不要使用file://协议）</div>`;
    }
}

function populateAwardSelect() {
    const select = document.getElementById('awardSelect');
    select.innerHTML = AWARD_OPTIONS.map(opt => 
        `<option value="${opt.value}">${opt.label}</option>`
    ).join('');
}

// ============= 事件监听 =============

function setupEventListeners() {
    // 快速查询事件
    document.getElementById('quickSchoolSearch').addEventListener('input', (e) => {
        searchQuickSchools(e.target.value);
    });
    
    document.getElementById('quickQueryBtn').addEventListener('click', executeQuickQuery);
    
    // 选项卡切换
    document.getElementById('showAdvancedLink').addEventListener('click', (e) => {
        e。preventDefault();
        document.getElementById('quickSearchSection').classList.add('hidden');
        document.getElementById('advancedSearchSection').classList.remove('hidden');
    });
    
    document。getElementById('backToQuickBtn').addEventListener('click', () => {
        document。getElementById('advancedSearchSection').classList.add('hidden');
        document.getElementById('quickSearchSection').classList.remove('hidden');
    });
    
    // 高级查询事件
    document。querySelectorAll('input[name="queryMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            queryMode = e。target.value;
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
    document。getElementById('schoolSearch')。addEventListener('input', (e) => {
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
        multiSection。classList.add('hidden');
    } else {
        singleSection.classList.add('hidden');
        multiSection.classList.remove('hidden');
    }
}

// ============= 快速查询 =============

function searchQuickSchools(keyword) {
    if (!keyword.trim()) {
        document.getElementById('quickSchoolResults').classList.add('hidden');
        return;
    }

    const results = oierDb.searchSchools(keyword).slice(0, 20);
    const resultsDiv = document.getElementById('quickSchoolResults');
    
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="search-item" style="color: #999;">未找到匹配的学校</div>';
        resultsDiv.classList.remove('hidden');
        return;
    }

    resultsDiv.innerHTML = results.map(school => 
        `<div class="search-item" onclick="selectQuickSchool(${school.id}, '${school.name.replace(/'/g, "\\'")}')">
            <strong>${school.name}</strong><br>
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
    
    console.time('快速查询耗时');

    // 使用 sql.js 查询
    const conditions = { name: nameInput };
    if (quickSelectedSchool !== null) {
        conditions.schoolId = quickSelectedSchool;
    }
    
    const candidateStudents = oierDb.selectStudents(conditions);
    
    // 如果有学校筛选，需要额外过滤
    let finalResults = candidateStudents;
    if (quickSelectedSchool !== null) {
        finalResults = candidateStudents.filter(student => {
            const records = oierDb.getStudentRecords(student.id);
            return records.some(record => record.school_id === quickSelectedSchool);
        });
    }

    console.timeEnd('快速查询耗时');
    console.log(`查询结果数: ${finalResults.length}`);

    displayQuickResults(finalResults);
}

function displayQuickResults(results) {
    const container = document.getElementById('quickResultsContainer');
    
    if (!resultRenderer) {
        container.innerHTML = '<div class="error">渲染器未初始化</div>';
        container.classList.remove('hidden');
        return;
    }
    
    // 使用新的卡片渲染器
    const html = resultRenderer.renderStudentCards(results, { maxCount: 10000 });
    container.innerHTML = html;
    container.classList.remove('hidden');
}

// ============= 搜索功能 =============

function searchContests(keyword) {
    if (!keyword.trim()) {
        document。getElementById('contestResults').classList.add('hidden');
        return;
    }

    const results = oierDb.searchContests(keyword);
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
    const staticData = oierDb.getStatic();
    selectedContest = {
        id: contestId,
        ...staticData.contests[contestId]
    };
    
    document.getElementById('contestSearch').value = selectedContest.name;
    document.getElementById('contestResults').classList.add('hidden');
    document.getElementById('selectedContestInfo').classList.remove('hidden');
}

function searchProvinces(keyword) {
    if (!keyword.trim()) {
        document.getElementById('provinceResults').classList.add('hidden');
        return;
    }

    const results = oierDb.searchProvinces(keyword);
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

    const results = oierDb.searchSchools(keyword).slice(0, 20);
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

// ============= 条件管理 =============

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

// ============= 单学生查询 =============

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
        
        // 构建查询条件
        const filters = {};
        if (nameFilter) filters.name = nameFilter;
        if (gradeFilter && gradeFilter.mode === 'single') filters.grade = gradeFilter.value;
        if (gradeFilter && gradeFilter.mode === 'range') filters.gradeRange = { start: gradeFilter.start, end: gradeFilter.end };
        
        // 构建奖项条件
        const awards = conditions.map(cond => ({
            contestId: cond.contest_id,
            award: cond.award || null,
            score: cond.score || null
        }));
        
        // 执行查询
        const queryResults = oierDb.queryStudents({ filters, awards });
        
        // 应用省份和学校过滤
        const staticData = oierDb.getStatic();
        const results = [];
        
        for (const { student, matchedAwards } of queryResults) {
            const records = oierDb.getStudentRecords(student.id);
            const studentSchools = new Set();
            const studentProvinces = new Set();
            const matchedRecords = [];
            
            for (const record of records) {
                const school = staticData.schools[record.school_id];
                if (school) {
                    studentSchools.add(school[0]);
                    studentProvinces.add(school[1]);
                }
                
                // 检查是否是匹配的奖项
                for (const { record: matchedRec } of matchedAwards) {
                    if (matchedRec === record) {
                        const contest = staticData.contests[record.contest_id];
                        matchedRecords.push({
                            contest: contest ? contest.name : '未知',
                            year: contest ? contest.year : 0,
                            score: record.score,
                            rank: record.rank,
                            award: oierDb.getAwardName(record.award_type, record.award_level),
                            school: school ? school[0] : '未知'
                        });
                    }
                }
            }
            
            // 应用省份过滤
            if (provinceFilter && !studentProvinces.has(provinceFilter)) {
                continue;
            }
            
            // 应用学校过滤
            if (schoolFilter !== null) {
                const hasSchool = records.some(r => r.school_id === schoolFilter);
                if (!hasSchool) continue;
            }
            
            results.push({
                id: student.id,
                name: student.name,
                abbr: student.abbr,
                enroll_year: student.enroll_year,
                schools: Array.from(studentSchools),
                provinces: Array.from(studentProvinces),
                matched_awards: matchedRecords.length > 0 ? matchedRecords : []
            });
        }
        
        displayResults(results);
        
        console.timeEnd('单学生查询耗时');
        queryBtn.disabled = false;
        queryBtn.textContent = '开始查询';
    }, 10000);
}

function displayResults(results) {
    const container = document.getElementById('resultsContainer');
    container.classList.remove('hidden');

    if (!resultRenderer) {
        container.innerHTML = '<div class="error">渲染器未初始化</div>';
        return;
    }

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

    if (results.length > 10000) {
        container.innerHTML = `
            <div class="error">
                <h3>查询结果过多</h3>
                <p>找到 ${results.length} 名符合条件的学生，超过了10000个的显示限制。</p>
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

    // 使用新的卡片渲染器
    const html = resultRenderer.renderStudentCards(results, { maxCount: 10000 });
    container.innerHTML = html;
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ============= 多学生管理（模态框）=============

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
    
    const staticData = oierDb.getStatic();
    
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

    const results = oierDb.searchContests(keyword);
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
    const staticData = oierDb.getStatic();
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

    const results = oierDb.searchProvinces(keyword);
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

    const results = oierDb.searchSchools(keyword).slice(0, 20);
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
    const staticData = oierDb.getStatic();
    
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
// 多学生查询逻辑（追加到main.js末尾）

// ============= 多学生查询 =============

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
        <div class="loading"><p>正在查询...</p></div>
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
            const percent = Math.min(10000, Math.round((doneCount / Math.max(1, totalStudents)) * 10000));
            progressBar.style.width = `${percent}%`;
            progressText.textContent = `${percent}% - ${message}`;
        };
        
        updateProgress(0, '初始化候选集...');
        const studentMatches = [];
        const indexes = oierDb.getIndexes();
        const staticData = oierDb.getStatic();
        
        // 辅助函数
        const intersectSets = (a, b) => {
            if (a === null) return b ? new Set(b) : new Set();
            if (!b || b.size === 0) return new Set();
            const [small, large] = a.size < b.size ? [a, b] : [b, a];
            const result = new Set();
            for (const v of small) {
                if (large.has(v)) result.add(v);
            }
            return result;
        };
        
        const cloneSet = (inputSet) => {
            return inputSet ? new Set(inputSet) : new Set();
        };
        
        const getSet = (map, key) => {
            const s = map.get(key);
            return s ? s : new Set();
        };
        
        const matchAward = (record, contestId, award, score) => {
            if (record.contest_id !== contestId) return false;
            if (score !== null && score !== undefined && Math.abs(record.score - score) > 0.01) {
                return false;
            }
            if (award) {
                const awardName = oierDb.getAwardName(record.award_type, record.award_level);
                if (!awardName.includes(award)) return false;
            }
            return true;
        };
        
        // 为每个学生查找匹配
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
                const nameStudents = indexes.studentIndexes.byName.get(studentCond.name);
                candidateIdSet = nameStudents ? new Set(nameStudents.map(s => s.id)) : new Set();
            }
            if (studentCond.grade) {
                intersect(getSet(indexes.gradeStudentIndex, studentCond.grade.toString()));
            }
            if (studentCond.school !== null) {
                intersect(getSet(indexes.schoolStudentIndex, studentCond.school));
            }
            if (studentCond.province) {
                intersect(getSet(indexes.provinceStudentIndex, studentCond.province));
            }
            if (studentCond.conditions.length > 0) {
                for (const condition of studentCond.conditions) {
                    intersect(getSet(indexes.contestStudentIndex, condition.contest_id));
                }
            }
            if (candidateIdSet === null) {
                candidateIdSet = cloneSet(indexes.allStudentIds);
            }
            
            const candidateStudents = Array.from(candidateIdSet)
                .map(id => oierDb.getStudent(id))
                .filter(Boolean);
            
            console.log(`学生${i+1}候选数(经索引交集): ${candidateStudents.length}`);
            
            for (const student of candidateStudents) {
                if (studentCond.name && student.abbr !== studentCond.name) continue;
                if (studentCond.grade) {
                    const enrollYear = parseInt(student.enroll_year);
                    if (enrollYear !== studentCond.grade) continue;
                }

                const records = oierDb.getStudentRecords(student.id);
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
                                award: oierDb.getAwardName(record.award_type, record.award_level),
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
            updateProgress(i + 1, `学生${i + 1} 完成，候选${candidateStudents.length} ，匹配${matches.length}`);
        }
        
        const result = findValidCombinations(studentMatches, commonProvince, commonSchool, commonGrade, 10000);
        
        displayMultiStudentResults(result, studentMatches, commonProvince, commonSchool, commonGrade);
        
        console.timeEnd('多学生查询耗时');
        queryBtn.disabled = false;
        queryBtn.textContent = '开始查询';
    }, 100);
}

function findValidCombinations(studentMatches, commonProvince, commonSchool, commonGrade, maxResults = 10000) {
    if (studentMatches.some(m => m.length === 0)) {
        return [];
    }

    const staticData = oierDb.getStatic();
    
    const intersectSets = (a, b) => {
        if (a === null) return b ? new Set(b) : new Set();
        if (!b || b.size === 0) return new Set();
        const [small, large] = a.size < b.size ? [a, b] : [b, a];
        const result = new Set();
        for (const v of small) {
            if (large.has(v)) result.add(v);
        }
        return result;
    };

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
        console.log(`共同学校: ${commonSchoolSet.size}`);
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
        console.log(`共同省份: ${commonProvinceSet.size}`);
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
        console.log(`共同年级: ${gradeSet.size}`);
        for (let i = 0; i < studentMatches.length; i++) {
            studentMatches[i] = studentMatches[i].filter(m => gradeSet.has(m.enroll_year));
        }
    }

    console.log('过滤后各学生候选数:', studentMatches.map((m, i) => `学生${i+1}:${m.length}`).join(', '));
    
    const totalCombinations = studentMatches.reduce((acc, m) => acc * m.length, 1);
    console.log(`理论组合: ${totalCombinations}`);
    
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

    const validCombinations = generateCombinationsOptimized(studentMatches, maxResults);
    console.log(`找到有效组合: ${validCombinations.length}`);
    return validCombinations;
}

function displayMultiStudentResults(result, allMatches, commonProvince, commonSchool, commonGrade) {
    const container = document.getElementById('multiResultsContainer');
    const staticData = oierDb.getStatic();
    container.classList.remove('hidden');
    
    if (result && result.error) {
        displayDiagnosticInfo(result, allMatches, commonProvince, commonSchool, commonGrade);
        return;
    }
    
    let combinations = Array.isArray(result) ? result : [];
    
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
    const staticData = oierDb.getStatic();
    
    let html = `
        <div class="error">
            <h3>诊断信息：未找到满足所有条件的组合</h3>
    `;
    
    if (result.error === 'no_common_school') {
        html += `<p><strong>问题：</strong>没有找到所有学生的共同学校交集。</p>`;
        html += `<p>各学生的学校信息：</p><ul style="margin-left: 20px;">`;
        allMatches.forEach((matches, i) => {
            const schools = new Set();
            matches.forEach(m => {
                m.schools.forEach(s => schools.add(s));
            });
            html += `<li><strong>学生 ${i+1}:</strong> `;
            const schoolList = Array.from(schools).map(sid => {
                const schoolName = staticData.schools[sid] ? staticData.schools[sid][0] : sid;
                return schoolName;
            });
            const displaySchools = schoolList.length > 5
                ? schoolList.slice(0, 5).join(', ') + ` 等${schoolList.length}个学校`
                : schoolList.join(', ');
            html += displaySchools;
            html += `</li>`;
        });
        html += `</ul>`;
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
