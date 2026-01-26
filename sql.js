/**
 * OIerDb SQL-like Data Access Layer
 * 提供类似 SQL 的接口来查询学生和比赛数据
 * 保持极高性能，使用索引和缓存优化
 */

class OIerDbSQL {
    constructor() {
        // 原始数据
        this.staticData = null;
        this.studentData = [];
        
        // 高性能索引
        this.studentIndexes = {
            byName: new Map(),        // abbr -> [students]
            byGrade: new Map(),       // enroll_year -> [students]
            byContest: new Map(),     // contest_id -> [students]
            bySchool: new Map(),      // school_id -> [students]
            byProvince: new Map()     // province -> [students]
        };
        
        // 高性能 Set 索引（用于快速交集运算）
        this.studentById = new Map();         // student_id -> student
        this.contestStudentIndex = new Map(); // contest_id -> Set<student_id>
        this.schoolStudentIndex = new Map();  // school_id -> Set<student_id>
        this.provinceStudentIndex = new Map();// province -> Set<student_id>
        this.gradeStudentIndex = new Map();   // enroll_year -> Set<student_id>
        this.allStudentIds = new Set();       // Set<student_id>
        
        // 缓存
        this.recordsCache = new Map();        // student_id -> [records]
    }
    
    /**
     * 初始化数据库，加载 static.json 和 result.txt
     */
    async initialize(onProgress) {
        try {
            // 更新进度回调
            const updateProgress = (percent, detail) => {
                if (onProgress) onProgress(percent, detail);
            };
            
            updateProgress(0, '开始加载数据...');
            
            // 加载静态数据
            updateProgress(10, '正在加载 static.json...');
            const staticResponse = await fetch('static.json');
            this.staticData = await staticResponse.json();
            updateProgress(40, 'static.json 加载完成');
            
            // 加载学生结果数据
            updateProgress(40, '正在加载 result.txt...');
            const resultResponse = await fetch('result.txt');
            const resultText = await resultResponse.text();
            updateProgress(70, 'result.txt 加载完成');
            
            // 解析学生数据
            updateProgress(70, '正在解析学生数据...');
            this.studentData = resultText.trim().split('\n')
                .map(line => this._parseStudentLine(line))
                .filter(s => s !== null);
            updateProgress(85, '学生数据解析完成');
            
            // 构建索引
            updateProgress(85, '正在构建索引...');
            this._buildIndexes();
            updateProgress(100, '全部加载完成');
            
            console.log(`[OIerDbSQL] 加载完成: ${this.staticData.contests.length} 个比赛, ${this.staticData.schools.length} 所学校, ${this.studentData.length} 名学生`);
            
            return true;
        } catch (error) {
            console.error('[OIerDbSQL] 数据加载失败:', error);
            throw error;
        }
    }
    
    /**
     * 解析单行学生数据
     */
    _parseStudentLine(line) {
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
    }
    
    /**
     * 构建高性能索引
     */
    _buildIndexes() {
        console.time('[OIerDbSQL] 构建索引耗时');
        
        // 清空索引
        this.studentIndexes.byName.clear();
        this.studentIndexes.byGrade.clear();
        this.studentIndexes.byContest.clear();
        this.studentIndexes.bySchool.clear();
        this.studentIndexes.byProvince.clear();
        this.recordsCache.clear();
        this.studentById.clear();
        this.contestStudentIndex.clear();
        this.schoolStudentIndex.clear();
        this.provinceStudentIndex.clear();
        this.gradeStudentIndex.clear();
        this.allStudentIds.clear();
        
        for (const student of this.studentData) {
            this.studentById.set(student.id, student);
            this.allStudentIds.add(student.id);
            
            // 姓名索引（支持多个学生使用相同简写）
            if (!this.studentIndexes.byName.has(student.abbr)) {
                this.studentIndexes.byName.set(student.abbr, []);
            }
            this.studentIndexes.byName.get(student.abbr).push(student);
            
            // 年级索引
            if (!this.studentIndexes.byGrade.has(student.enroll_year)) {
                this.studentIndexes.byGrade.set(student.enroll_year, []);
            }
            this.studentIndexes.byGrade.get(student.enroll_year).push(student);
            if (!this.gradeStudentIndex.has(student.enroll_year)) {
                this.gradeStudentIndex.set(student.enroll_year, new Set());
            }
            this.gradeStudentIndex.get(student.enroll_year).add(student.id);
            
            // 解析并缓存记录
            const records = this.parseRecord(student.records);
            this.recordsCache.set(student.id, records);
            
            // 为每条记录建立索引
            for (const record of records) {
                // 比赛索引
                if (!this.studentIndexes.byContest.has(record.contest_id)) {
                    this.studentIndexes.byContest.set(record.contest_id, []);
                }
                if (!this.studentIndexes.byContest.get(record.contest_id).includes(student)) {
                    this.studentIndexes.byContest.get(record.contest_id).push(student);
                }
                if (!this.contestStudentIndex.has(record.contest_id)) {
                    this.contestStudentIndex.set(record.contest_id, new Set());
                }
                this.contestStudentIndex.get(record.contest_id).add(student.id);
                
                // 学校索引
                if (!this.studentIndexes.bySchool.has(record.school_id)) {
                    this.studentIndexes.bySchool.set(record.school_id, []);
                }
                if (!this.studentIndexes.bySchool.get(record.school_id).includes(student)) {
                    this.studentIndexes.bySchool.get(record.school_id).push(student);
                }
                if (!this.schoolStudentIndex.has(record.school_id)) {
                    this.schoolStudentIndex.set(record.school_id, new Set());
                }
                this.schoolStudentIndex.get(record.school_id).add(student.id);
                
                // 省份索引
                const school = this.staticData.schools[record.school_id];
                if (school && school[1]) {
                    const province = school[1];
                    if (!this.studentIndexes.byProvince.has(province)) {
                        this.studentIndexes.byProvince.set(province, []);
                    }
                    if (!this.studentIndexes.byProvince.get(province).includes(student)) {
                        this.studentIndexes.byProvince.get(province).push(student);
                    }
                    if (!this.provinceStudentIndex.has(province)) {
                        this.provinceStudentIndex.set(province, new Set());
                    }
                    this.provinceStudentIndex.get(province).add(student.id);
                }
            }
        }
        
        console.timeEnd('[OIerDbSQL] 构建索引耗时');
        console.log(`[OIerDbSQL] 索引统计: 姓名=${this.studentIndexes.byName.size}, 年级=${this.studentIndexes.byGrade.size}, 比赛=${this.studentIndexes.byContest.size}, 学校=${this.studentIndexes.bySchool.size}, 省份=${this.studentIndexes.byProvince.size}`);
    }
    
    /**
     * 解析记录字符串为记录数组
     */
    parseRecord(recordStr) {
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
    
    /**
     * 获取奖项名称
     */
    getAwardName(awardType, awardLevel) {
        const awardMap = {
            0: "金牌",
            1: "银牌",
            2: "铜牌",
            3: "一等奖",
            4: "二等奖",
            5: "三等奖"
        };
        return awardMap[awardLevel] || `奖项(level=${awardLevel})`;
    }
    
    /**
     * 获取学生记录（带缓存）
     */
    getStudentRecords(studentId) {
        return this.recordsCache.get(studentId) || [];
    }
    
    /**
     * 查询学生 - WHERE 子句支持
     * @param {Object} conditions - 查询条件
     * @returns {Array} 匹配的学生列表
     */
    selectStudents(conditions = {}) {
        let candidates = null;
        
        // 使用索引快速获取候选集
        if (conditions.name) {
            const students = this.studentIndexes.byName.get(conditions.name);
            candidates = students ? new Set(students.map(s => s.id)) : new Set();
        }
        
        if (conditions.grade) {
            const gradeSet = this.gradeStudentIndex.get(conditions.grade.toString()) || new Set();
            candidates = this._intersectSets(candidates, gradeSet);
        }
        
        if (conditions.contestId !== undefined) {
            const contestSet = this.contestStudentIndex.get(conditions.contestId) || new Set();
            candidates = this._intersectSets(candidates, contestSet);
        }
        
        if (conditions.schoolId !== undefined) {
            const schoolSet = this.schoolStudentIndex.get(conditions.schoolId) || new Set();
            candidates = this._intersectSets(candidates, schoolSet);
        }
        
        if (conditions.province) {
            const provinceSet = this.provinceStudentIndex.get(conditions.province) || new Set();
            candidates = this._intersectSets(candidates, provinceSet);
        }
        
        // 如果没有任何条件，返回所有学生
        if (candidates === null) {
            candidates = this.allStudentIds;
        }
        
        // 将 ID 集合转换为学生对象
        const results = Array.from(candidates)
            .map(id => this.studentById.get(id))
            .filter(Boolean);
        
        // 应用额外的过滤条件
        return results.filter(student => {
            if (conditions.gradeRange) {
                const year = parseInt(student.enroll_year);
                if (year < conditions.gradeRange.start || year > conditions.gradeRange.end) {
                    return false;
                }
            }
            return true;
        });
    }
    
    /**
     * 复杂查询 - 支持多个奖项条件的匹配
     * @param {Object} query - 查询对象
     * @returns {Array} 匹配的学生结果
     */
    queryStudents(query) {
        const { filters = {}, awards = [] } = query;
        
        // 获取基础候选集
        let candidates = this.selectStudents(filters);
        
        // 如果没有奖项条件，直接返回候选集
        if (awards.length === 0) {
            return candidates.map(student => ({
                student,
                matchedAwards: []
            }));
        }
        
        // 过滤符合奖项条件的学生
        const results = [];
        for (const student of candidates) {
            const records = this.getStudentRecords(student.id);
            let allMatched = true;
            const matchedRecords = [];
            
            for (const awardCond of awards) {
                let found = false;
                
                for (const record of records) {
                    if (this._matchAward(record, awardCond)) {
                        found = true;
                        matchedRecords.push({
                            record,
                            condition: awardCond
                        });
                        break;
                    }
                }
                
                if (!found) {
                    allMatched = false;
                    break;
                }
            }
            
            if (allMatched) {
                results.push({
                    student,
                    matchedAwards: matchedRecords
                });
            }
        }
        
        return results;
    }
    
    /**
     * 匹配奖项条件
     */
    _matchAward(record, condition) {
        if (record.contest_id !== condition.contestId) return false;
        
        if (condition.score !== null && condition.score !== undefined) {
            if (Math.abs(record.score - condition.score) > 0.01) {
                return false;
            }
        }
        
        if (condition.award) {
            const awardName = this.getAwardName(record.award_type, record.award_level);
            if (!awardName.includes(condition.award)) return false;
        }
        
        return true;
    }
    
    /**
     * 交集运算
     */
    _intersectSets(a, b) {
        if (a === null) return b ? new Set(b) : new Set();
        if (!b || b.size === 0) return new Set();
        
        const [small, large] = a.size < b.size ? [a, b] : [b, a];
        const result = new Set();
        for (const v of small) {
            if (large.has(v)) result.add(v);
        }
        return result;
    }
    
    /**
     * 获取静态数据
     */
    getStatic() {
        return this.staticData;
    }
    
    /**
     * 搜索比赛
     */
    searchContests(keyword) {
        if (!keyword.trim()) return [];
        
        return this.staticData.contests
            .map((contest, idx) => ({ id: idx, ...contest }))
            .filter(contest => contest.name.toLowerCase().includes(keyword.toLowerCase()));
    }
    
    /**
     * 搜索学校
     */
    searchSchools(keyword) {
        if (!keyword.trim()) return [];
        
        return this.staticData.schools
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
            );
    }
    
    /**
     * 获取所有省份列表
     */
    getProvinces() {
        return [...new Set(this.staticData.schools.map(s => s[1]))];
    }
    
    /**
     * 搜索省份
     */
    searchProvinces(keyword) {
        if (!keyword.trim()) return this.getProvinces();
        
        return this.getProvinces()
            .filter(p => p.toLowerCase().includes(keyword.toLowerCase()));
    }
    
    /**
     * 获取学校信息
     */
    getSchool(schoolId) {
        return this.staticData.schools[schoolId];
    }
    
    /**
     * 获取比赛信息
     */
    getContest(contestId) {
        return this.staticData.contests[contestId];
    }
    
    /**
     * 获取学生信息
     */
    getStudent(studentId) {
        return this.studentById.get(studentId);
    }
    
    /**
     * 获取索引引用（用于高级查询）
     */
    getIndexes() {
        return {
            studentIndexes: this.studentIndexes,
            contestStudentIndex: this.contestStudentIndex,
            schoolStudentIndex: this.schoolStudentIndex,
            provinceStudentIndex: this.provinceStudentIndex,
            gradeStudentIndex: this.gradeStudentIndex,
            allStudentIds: this.allStudentIds
        };
    }
}

// 导出单例
const oierDb = new OIerDbSQL();
