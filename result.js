/**
 * OIerDb Result Card Renderer
 * 负责渲染学生结果卡片和详情弹窗
 */

class ResultCardRenderer {
    constructor(oierDb) {
        this.oierDb = oierDb;
        this.staticData = null;
    }

    /**
     * 初始化
     */
    init() {
        this.staticData = this.oierDb.getStatic();
    }

    /**
     * 渲染单个学生卡片
     * @param {Object} student - 学生对象
     * @param {Array} matchedAwards - 匹配的奖项（可选）
     * @returns {string} HTML 字符串
     */
    renderStudentCard(student, matchedAwards = []) {
        const records = this.oierDb.getStudentRecords(student.id);
        
        // 获取学生的所有学校和省份信息
        const schoolsSet = new Set();
        const provincesSet = new Set();
        
        records.forEach(record => {
            const school = this.staticData.schools[record.school_id];
            if (school) {
                schoolsSet.add(school[0]);
                if (school[1]) provincesSet.add(school[1]);
            }
        });
        
        const schools = Array.from(schoolsSet);
        const provinces = Array.from(provincesSet);
        
        // 统计获奖情况
        const awardStats = this._getAwardStatistics(records);
        
        // 获取最佳成绩
        const bestAchievements = this._getBestAchievements(records);
        
        return `
            <div class="student-card" onclick="openStudentDetail('${student.id}')">
                <div class="student-card-header">
                    <div class="student-name">
                        <span class="name-full">${student.name || '未知'}</span>
                        <span class="name-abbr">(${student.abbr})</span>
                    </div>
                </div>
                
                <div class="student-card-body">
                    <div class="info-row">
                        <span class="info-label">入学年份</span>
                        <span class="info-value">${student.enroll_year}</span>
                    </div>
                    
                    ${provinces.length > 0 ? `
                    <div class="info-row">
                        <span class="info-label">省份</span>
                        <span class="info-value">${provinces.join('、')}</span>
                    </div>
                    ` : ''}
                    
                    ${schools.length > 0 ? `
                    <div class="info-row">
                        <span class="info-label">学校</span>
                        <span class="info-value info-schools">${schools.slice(0, 2).join('、')}${schools.length > 2 ? '等' : ''}</span>
                    </div>
                    ` : ''}
                    
                    <div class="info-row">
                        <span class="info-label">参赛次数</span>
                        <span class="info-value">${records.length} 次</span>
                    </div>
                    
                    ${bestAchievements.length > 0 ? `
                    <div class="best-achievements">
                        <div class="info-label">最佳成绩</div>
                        <div class="achievements-list">
                            ${bestAchievements.slice(0, 3).map(achievement => `
                                <div class="achievement-item">
                                    ${this._getAwardBadgeHTML(achievement.award)}
                                    <span class="achievement-contest">${achievement.contestName}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="award-summary">
                        ${this._renderAwardSummary(awardStats)}
                    </div>
                </div>
                
                <div class="student-card-footer">
                    <span class="view-detail-hint">点击查看详情 →</span>
                </div>
            </div>
        `;
    }

    /**
     * 批量渲染学生卡片
     * @param {Array} students - 学生数组
     * @param {Object} options - 渲染选项
     * @returns {string} HTML 字符串
     */
    renderStudentCards(students, options = {}) {
        const { matchedAwards = null, maxCount = 100 } = options;
        
        if (students.length === 0) {
            return `
                <div class="no-results">
                    <p>未找到符合条件的学生</p>
                    <small>请尝试调整查询条件</small>
                </div>
            `;
        }
        
        const displayStudents = students.slice(0, maxCount);
        const hasMore = students.length > maxCount;
        
        let html = `
            <div class="results-header">
                <h3>找到 ${students.length} 名符合条件的学生</h3>
                ${hasMore ? `<p class="results-note">显示前 ${maxCount} 名结果</p>` : ''}
            </div>
            <div class="student-cards-grid">
        `;
        
        displayStudents.forEach(studentData => {
            const student = studentData.student || studentData;
            const awards = studentData.matchedAwards || [];
            html += this.renderStudentCard(student, awards);
        });
        
        html += '</div>';
        
        return html;
    }

    /**
     * 打开学生详情弹窗
     * @param {string} studentId - 学生 ID
     */
    openStudentDetail(studentId) {
        const student = this.oierDb.getStudent(studentId);
        if (!student) {
            alert('学生信息未找到');
            return;
        }
        
        const modal = this._createDetailModal(student);
        document.body.appendChild(modal);
        
        // 添加动画效果
        setTimeout(() => modal.classList.add('active'), 10);
        
        // 设置关闭事件
        this._setupDetailModalEvents(modal);
    }

    /**
     * 创建详情弹窗
     */
    _createDetailModal(student) {
        const modal = document.createElement('div');
        modal.className = 'detail-modal';
        modal.id = 'studentDetailModal';
        
        const records = this.oierDb.getStudentRecords(student.id);
        const awardStats = this._getAwardStatistics(records);
        const analysis = this._generateAnalysis(student, records);
        
        modal.innerHTML = `
            <div class="detail-modal-overlay" onclick="closeStudentDetail()"></div>
            <div class="detail-modal-content">
                <button class="detail-modal-close" onclick="closeStudentDetail()">&times;</button>
                
                <div class="detail-header">
                    <div class="detail-title">
                        <h2>${student.name || '未知'}</h2>
                        <span class="detail-abbr">${student.abbr}</span>
                    </div>
                    <div class="detail-basic-info">
                        <span>入学年份：${student.enroll_year}</span>
                        <span>参赛次数：${records.length}</span>
                    </div>
                </div>
                
                <div class="detail-body">
                    <!-- 数据分析 -->
                    <div class="detail-section">
                        <h3 class="detail-section-title">数据分析</h3>
                        <div class="analysis-grid">
                            ${this._renderAnalysisCards(analysis)}
                        </div>
                    </div>
                    
                    <!-- 获奖统计 -->
                    <div class="detail-section">
                        <h3 class="detail-section-title">获奖统计</h3>
                        <div class="award-stats-grid">
                            ${this._renderDetailedAwardStats(awardStats)}
                        </div>
                    </div>
                    
                    <!-- 历史排名趋势 -->
                    <div class="detail-section">
                        <h3 class="detail-section-title">历史排名趋势</h3>
                        ${this._renderRankChart(student.id)}
                    </div>
                    
                    <!-- 所有获奖记录 -->
                    <div class="detail-section">
                        <h3 class="detail-section-title">所有获奖记录 (${records.length})</h3>
                        <div class="records-table">
                            ${this._renderRecordsTable(records, student.id)}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        return modal;
    }

    /**
     * 渲染分析卡片
     */
    _renderAnalysisCards(analysis) {
        return `
            <div class="analysis-card">
                <div class="analysis-label">最佳奖项</div>
                <div class="analysis-value">${analysis.bestAward}</div>
            </div>
            <div class="analysis-card">
                <div class="analysis-label">跨省参赛</div>
                <div class="analysis-value">${analysis.provinceCount > 1 ? '是' : '否'}</div>
            </div>
            <div class="analysis-card">
                <div class="analysis-label">参赛跨度</div>
                <div class="analysis-value">${analysis.yearSpan}</div>
            </div>
        `;
    }

    /**
     * 渲染详细获奖统计
     */
    _renderDetailedAwardStats(stats) {
        const awardTypes = [
            { key: 'gold', label: '金牌', class: 'gold' },
            { key: 'silver', label: '银牌', class: 'silver' },
            { key: 'bronze', label: '铜牌', class: 'bronze' },
            { key: 'first', label: '一等奖', class: 'first' },
            { key: 'second', label: '二等奖', class: 'second' },
            { key: 'third', label: '三等奖', class: 'third' }
        ];
        
        return awardTypes.map(type => `
            <div class="award-stat-card award-stat-${type.class}">
                <div class="award-stat-label">${type.label}</div>
                <div class="award-stat-count">${stats[type.key] || 0}</div>
            </div>
        `).join('');
    }

    /**
     * 渲染时间线
     */
    _renderTimeline(timeline) {
        if (timeline.length === 0) {
            return '<p class="timeline-empty">暂无参赛记录</p>';
        }
        
        return timeline.map(item => `
            <div class="timeline-item">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <span class="timeline-date">${item.year}年</span>
                        <span class="timeline-contest">${item.contestName}</span>
                    </div>
                    <div class="timeline-body">
                        <div class="timeline-award">
                            ${this._getAwardBadgeHTML(item.award)}
                        </div>
                        <div class="timeline-details">
                            <span>分数: ${item.score}</span>
                            <span>排名: ${item.rank}</span>
                            <span>学校: ${item.schoolName}</span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * 渲染记录表格
     */
    _renderRecordsTable(records, studentId) {
        if (records.length === 0) {
            return '<p class="records-empty">暂无获奖记录</p>';
        }
        
        return `
            <table class="records-table-element">
                <thead>
                    <tr>
                        <th width="40">操作</th>
                        <th>比赛</th>
                        <th>年份</th>
                        <th>学校</th>
                        <th>省份</th>
                        <th>分数</th>
                        <th>排名</th>
                        <th>奖项</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map((record, idx) => {
                        const contest = this.staticData.contests[record.contest_id];
                        const school = this.staticData.schools[record.school_id];
                        const award = this.oierDb.getAwardName(record.award_type, record.award_level);
                        const recordId = `record-${studentId}-${idx}`;
                        
                        return `
                            <tr class="record-row">
                                <td>
                                    <button class="expand-btn" onclick="toggleRecordDetail('${recordId}', ${record.contest_id}, ${record.score}, ${record.rank || 0}, '${studentId}')">
                                        <span class="expand-icon">▶</span>
                                    </button>
                                </td>
                                <td>${contest ? contest.name : '未知比赛'}</td>
                                <td>${contest ? contest.year : '-'}</td>
                                <td>${school ? school[0] : '未知学校'}</td>
                                <td>${school ? school[1] : '-'}</td>
                                <td>${record.score}</td>
                                <td>${record.rank || '-'}</td>
                                <td>${this._getAwardBadgeHTML(award)}</td>
                            </tr>
                            <tr class="record-detail-row" id="${recordId}" style="display: none;">
                                <td colspan="8">
                                    <div class="record-detail-content">
                                        <div class="detail-loading">加载中...</div>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    /**
     * 获取获奖统计
     */
    _getAwardStatistics(records) {
        const stats = {
            gold: 0,
            silver: 0,
            bronze: 0,
            first: 0,
            second: 0,
            third: 0,
            total: records.length
        };
        
        records.forEach(record => {
            const award = this.oierDb.getAwardName(record.award_type, record.award_level);
            if (award.includes('金牌')) stats.gold++;
            else if (award.includes('银牌')) stats.silver++;
            else if (award.includes('铜牌')) stats.bronze++;
            else if (award.includes('一等奖')) stats.first++;
            else if (award.includes('二等奖')) stats.second++;
            else if (award.includes('三等奖')) stats.third++;
        });
        
        return stats;
    }

    /**
     * 获取最佳成就
     */
    _getBestAchievements(records) {
        // 按奖项等级排序
        const awardPriority = {
            '金牌': 1,
            '银牌': 2,
            '铜牌': 3,
            '一等奖': 4,
            '二等奖': 5,
            '三等奖': 6
        };
        
        const achievements = records.map(record => {
            const contest = this.staticData.contests[record.contest_id];
            const award = this.oierDb.getAwardName(record.award_type, record.award_level);
            return {
                contestName: contest ? contest.name : '未知比赛',
                award: award,
                score: record.score,
                priority: awardPriority[award] || 999
            };
        });
        
        achievements.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return b.score - a.score;
        });
        
        return achievements.slice(0, 5);
    }

    /**
     * 生成时间线数据
     */
    _generateTimeline(records) {
        return records.map(record => {
            const contest = this.staticData.contests[record.contest_id];
            const school = this.staticData.schools[record.school_id];
            const award = this.oierDb.getAwardName(record.award_type, record.award_level);
            
            return {
                year: contest ? contest.year : '未知',
                contestName: contest ? contest.name : '未知比赛',
                schoolName: school ? school[0] : '未知学校',
                award: award,
                score: record.score,
                rank: record.rank || '-'
            };
        }).sort((a, b) => b.year - a.year);
    }

    /**
     * 生成分析数据
     */
    _generateAnalysis(student, records) {
        const schools = new Set();
        const provinces = new Set();
        const years = new Set();
        let maxScore = 0;
        let bestAward = '无';
        
        const awardPriority = {
            '金牌': 1, '银牌': 2, '铜牌': 3,
            '一等奖': 4, '二等奖': 5, '三等奖': 6
        };
        let bestAwardPriority = 999;
        
        records.forEach(record => {
            const school = this.staticData.schools[record.school_id];
            if (school) {
                schools.add(school[0]);
                provinces.add(school[1]);
            }
            
            const contest = this.staticData.contests[record.contest_id];
            if (contest) years.add(contest.year);
            
            if (record.score > maxScore) maxScore = record.score;
            
            const award = this.oierDb.getAwardName(record.award_type, record.award_level);
            const priority = awardPriority[award] || 999;
            if (priority < bestAwardPriority) {
                bestAwardPriority = priority;
                bestAward = award;
            }
        });
        
        const sortedYears = Array.from(years).sort();
        const yearSpan = sortedYears.length > 1 
            ? `${sortedYears[0]}-${sortedYears[sortedYears.length - 1]}`
            : sortedYears[0] || '未知';
        
        const awardCount = records.filter(r => {
            const award = this.oierDb.getAwardName(r.award_type, r.award_level);
            return ['金牌', '银牌', '铜牌', '一等奖', '二等奖', '三等奖'].includes(award);
        }).length;
        
        const awardRate = records.length > 0 
            ? `${Math.round(awardCount / records.length * 100)}%`
            : '0%';
        
        return {
            maxScore: maxScore || '未知',
            bestAward: bestAward,
            schoolCount: schools.size,
            provinceCount: provinces.size,
            yearSpan: yearSpan,
            awardRate: awardRate
        };
    }

    /**
     * 渲染获奖摘要
     */
    _renderAwardSummary(stats) {
        const medals = [];
        if (stats.gold > 0) medals.push(`金牌 ${stats.gold}`);
        if (stats.silver > 0) medals.push(`银牌 ${stats.silver}`);
        if (stats.bronze > 0) medals.push(`铜牌 ${stats.bronze}`);
        
        const prizes = [];
        if (stats.first > 0) prizes.push(`一等奖 ${stats.first}`);
        if (stats.second > 0) prizes.push(`二等奖 ${stats.second}`);
        if (stats.third > 0) prizes.push(`三等奖 ${stats.third}`);
        
        const parts = [...medals, ...prizes];
        
        if (parts.length === 0) {
            return '<span class="award-summary-empty">暂无获奖记录</span>';
        }
        
        return parts.join(' <span class="award-separator">·</span> ');
    }

    /**
     * 获取奖项徽章 HTML
     */
    _getAwardBadgeHTML(award) {
        const badgeMap = {
            '金牌': 'gold',
            '银牌': 'silver',
            '铜牌': 'bronze',
            '一等奖': 'first',
            '二等奖': 'second',
            '三等奖': 'third'
        };
        
        const badgeClass = badgeMap[award] || 'default';
        return `<span class="badge badge-${badgeClass}">${award}</span>`;
    }

    /**
     * 获取比赛的所有参赛者分数
     */
    _getContestScores(contestId) {
        const scores = [];
        const allStudents = Array.from(this.oierDb.studentById.values());
        
        allStudents.forEach(student => {
            const records = this.oierDb.getStudentRecords(student.id);
            records.forEach(record => {
                if (record.contest_id === contestId) {
                    scores.push(record.score);
                }
            });
        });
        
        return scores.sort((a, b) => b - a);
    }
    
    /**
     * 绘制正态分布图
     */
    _renderScoreDistribution(contestId, studentScore, studentRank) {
        const scores = this._getContestScores(contestId);
        if (scores.length === 0) return '<p>无法获取比赛数据</p>';
        
        // 计算统计数据
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        
        // 创建分数区间
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        const bins = 40;  // 增加到40个区间，使分布更细分
        const binSize = (max - min) / bins;
        const histogram = new Array(bins).fill(0);
        
        scores.forEach(score => {
            const binIndex = Math.min(Math.floor((score - min) / binSize), bins - 1);
            histogram[binIndex]++;
        });
        
        const maxCount = Math.max(...histogram);
        const studentBin = Math.min(Math.floor((studentScore - min) / binSize), bins - 1);
        
        // 生成柱状图HTML
        let chartHTML = '<div class="distribution-chart">';
        for (let i = 0; i < bins; i++) {
            const height = (histogram[i] / maxCount) * 100;
            const isStudentBin = i === studentBin;
            // 只显示每8个标签，适应40个bins
            const showLabel = i % 8 === 0 || i === bins - 1;
            const labelValue = Math.round(min + i * binSize);
            
            chartHTML += `
                <div class="bar-container">
                    <div class="bar ${isStudentBin ? 'highlight' : ''}" style="height: ${height}%" title="分数区间: ${labelValue}-${Math.round(min + (i + 1) * binSize)}, 人数: ${histogram[i]}">
                        ${histogram[i] > 0 ? `<span class="bar-count">${histogram[i]}</span>` : ''}
                    </div>
                    ${showLabel ? `<div class="bar-label">${labelValue}</div>` : '<div class="bar-label"></div>'}
                </div>
            `;
        }
        chartHTML += '</div>';
        
        return `
            <div class="distribution-section">
                <h4>本场比赛分数分布</h4>
                <div class="distribution-stats">
                    <span>参赛人数: <strong>${scores.length}</strong></span>
                    <span>平均分: <strong>${mean.toFixed(1)}</strong></span>
                    <span>标准差: <strong>${stdDev.toFixed(1)}</strong></span>
                </div>
                <div class="distribution-student-info">
                    <span class="student-marker">该选手分数: <strong>${studentScore}</strong> | 排名: <strong>${studentRank || '-'}</strong></span>
                </div>
                ${chartHTML}
                <div class="distribution-note">* 橙红色柱表示该选手所在分数区间</div>
            </div>
        `;
    }
    
    /**
     * 绘制排名折线图
     */
    _renderRankChart(studentId) {
        const records = this.oierDb.getStudentRecords(studentId);
        if (records.length === 0) return '<p class="no-rank-data">无排名数据</p>';
        
        // 过滤有效排名并按比赛ID排序（时间顺序）
        const validRecords = records
            .filter(r => r.rank && r.rank > 0)
            .sort((a, b) => a.contest_id - b.contest_id);
        
        if (validRecords.length === 0) {
            return '<p class="no-rank-data">暂无排名数据</p>';
        }
        
        const ranks = validRecords.map(r => r.rank);
        const minRank = Math.min(...ranks);
        const maxRank = Math.max(...ranks);
        const rankRange = maxRank - minRank || 1;
        
        // 生成SVG路径和点
        let points = [];
        let pathData = '';
        
        validRecords.forEach((record, idx) => {
            const contest = this.staticData.contests[record.contest_id];
            const contestName = contest ? contest.name : `比赛${record.contest_id}`;
            const xPos = (idx / Math.max(validRecords.length - 1, 1)) * 100;
            // 排名越小越靠上，反转y坐标
            const yPos = 100 - ((record.rank - minRank) / rankRange * 80 + 10);
            
            points.push({
                x: xPos,
                y: yPos,
                rank: record.rank,
                contestName: contestName,
                year: contest ? contest.year : ''
            });
            
            if (idx === 0) {
                pathData = `M ${xPos} ${yPos}`;
            } else {
                pathData += ` L ${xPos} ${yPos}`;
            }
        });
        
        // 生成排名轴刻度
        const rankTicks = [];
        const tickCount = 5;
        for (let i = 0; i < tickCount; i++) {
            const rank = Math.round(minRank + (rankRange * i / (tickCount - 1)));
            const yPos = 100 - ((rank - minRank) / rankRange * 80 + 10);
            rankTicks.push({ rank, y: yPos });
        }
        
        return `
            <div class="rank-section">
                <div class="rank-stats">
                    <span>最佳排名: <strong>${minRank}</strong></span>
                    <span>最低排名: <strong>${maxRank}</strong></span>
                    <span>参赛次数: <strong>${validRecords.length}</strong></span>
                </div>
                <div class="rank-chart-wrapper">
                    <svg class="rank-chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <!-- 背景网格 -->
                        <defs>
                            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>
                            </pattern>
                        </defs>
                        <rect width="100" height="100" fill="url(#grid)" />
                        
                        <!-- 折线 -->
                        <path d="${pathData}" fill="none" stroke="#4da6d6" stroke-width="0.5" />
                        
                        <!-- 数据点 -->
                        ${points.map(p => `
                            <circle cx="${p.x}" cy="${p.y}" r="1.5" fill="#4da6d6" stroke="#242424" stroke-width="0.5">
                                <title>${p.contestName} (${p.year})年 - 排名: ${p.rank}</title>
                            </circle>
                        `).join('')}
                    </svg>
                    
                    <!-- Y轴刻度 -->
                    <div class="rank-y-axis">
                        ${rankTicks.map(tick => `
                            <div class="rank-tick" style="top: ${tick.y}%;">
                                <span class="tick-label">${tick.rank}</span>
                                <span class="tick-line"></span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <!-- 数据点标签 -->
                    <div class="rank-points-overlay">
                        ${points.map(p => `
                            <div class="rank-point-marker" style="left: ${p.x}%; top: ${p.y}%;" 
                                 title="${p.contestName} (${p.year})年 - 排名: ${p.rank}">
                                <div class="point-dot"></div>
                                <div class="point-label">${p.rank}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="rank-axis-labels">
                    <span class="axis-label-y">排名</span>
                    <span class="axis-label-x">比赛时间顺序</span>
                </div>
            </div>
        `;
    }

    /**
     * 设置详情弹窗事件
     */
    _setupDetailModalEvents(modal) {
        // ESC 键关闭
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeStudentDetail();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        
        // 存储事件处理器以便后续移除
        modal._keydownHandler = handleKeyDown;
    }
}

// 全局函数：打开学生详情
function openStudentDetail(studentId) {
    if (window.resultRenderer) {
        window.resultRenderer.openStudentDetail(studentId);
    }
}

// 全局函数：关闭学生详情
function closeStudentDetail() {
    const modal = document.getElementById('studentDetailModal');
    if (modal) {
        modal.classList.remove('active');
        
        // 移除事件监听器
        if (modal._keydownHandler) {
            document.removeEventListener('keydown', modal._keydownHandler);
        }
        
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// 全局函数：切换记录详情展开/收起
function toggleRecordDetail(recordId, contestId, studentScore, studentRank, studentId) {
    const detailRow = document.getElementById(recordId);
    const btn = event.target.closest('.expand-btn');
    const icon = btn.querySelector('.expand-icon');
    
    if (detailRow.style.display === 'none') {
        // 展开
        detailRow.style.display = 'table-row';
        icon.style.transform = 'rotate(90deg)';
        
        // 加载详情内容
        if (!detailRow._loaded) {
            const content = detailRow.querySelector('.record-detail-content');
            const renderer = window.resultRenderer;
            
            if (renderer) {
                const distributionHTML = renderer._renderScoreDistribution(contestId, studentScore, studentRank);
                
                content.innerHTML = `
                    <div class="record-charts">
                        ${distributionHTML}
                    </div>
                `;
            }
            
            detailRow._loaded = true;
        }
    } else {
        // 收起
        detailRow.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
}
