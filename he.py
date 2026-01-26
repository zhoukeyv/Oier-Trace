#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
from typing import List, Dict, Optional

class OIerQuery:
    def __init__(self, static_path='static.json', result_path='result.txt'):
        self.schools = []
        self.contests = []
        self.province_map = {}
        self.school_map = {}
        
        self.load_static(static_path)
        self.students = self.load_results(result_path)
        
    def load_static(self, path: str):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
                if 'schools' in data:
                    self.schools = data['schools']
                    for idx, school in enumerate(self.schools):
                        if len(school) >= 4:
                            school_name, province, city, score = school[0], school[1], school[2], school[3]
                            self.school_map[idx] = {
                                'name': school_name,
                                'province': province,
                                'city': city,
                                'score': score
                            }
                            if province not in self.province_map:
                                self.province_map[province] = []
                            self.province_map[province].append(idx)
                
                if 'contests' in data:
                    self.contests = data['contests']
                    
            print(f"✓ 加载了 {len(self.contests)} 个比赛和 {len(self.schools)} 所学校")
                    
        except Exception as e:
            print(f"✗ 加载static.json失败: {e}")
    
    def load_results(self, path: str) -> List[Dict]:
        students = []
        try:
            with open(path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    parts = line.split(',')
                    if len(parts) < 7:
                        continue
                    
                    student = {
                        'id': parts[0],
                        'abbr': parts[1],
                        'name': parts[2],
                        'gender': parts[3],
                        'enroll_year': parts[4],
                        'score': parts[5],
                        'avg_score': parts[6],
                        'records_count': parts[7] if len(parts) > 7 else '0',
                        'records': parts[8] if len(parts) > 8 else ''
                    }
                    students.append(student)
            
            print(f"✓ 加载了 {len(students)} 名学生数据\n")
                    
        except Exception as e:
            print(f"✗ 加载result.txt失败: {e}")
        
        return students
    
    def parse_record(self, record_str: str) -> List[Dict]:
        # 格式: contest_id:school_id:score:rank:award_type:award_level
        records = []
        if not record_str:
            return records
        
        for rec in record_str.split('/'):
            parts = rec.split(':')
            if len(parts) >= 6:
                try:
                    score = float(parts[2]) if parts[2] else 0.0
                    rank = int(parts[3]) if parts[3] else 0
                    
                    records.append({
                        'contest_id': int(parts[0]),
                        'school_id': int(parts[1]),
                        'score': score,
                        'rank': rank,
                        'award_type': int(parts[4]),
                        'award_level': int(parts[5])
                    })
                except (ValueError, IndexError):
                    continue
        return records
    
    def get_contest_by_id(self, contest_id: int) -> Optional[Dict]:
        if 0 <= contest_id < len(self.contests):
            contest = self.contests[contest_id].copy()
            contest['id'] = contest_id
            return contest
        return None
    
    def get_school_by_id(self, school_id: int) -> Optional[Dict]:
        return self.school_map.get(school_id)
    
    def get_award_name(self, award_type: int, award_level: int) -> str:
        if award_level == 0:
            return "🥇金牌"
        elif award_level == 1:
            return "🥈银牌"
        elif award_level == 2:
            return "🥉铜牌"
        elif award_level == 3:
            return "一等奖"
        elif award_level == 4:
            return "二等奖"
        elif award_level == 5:
            return "三等奖"
        
        
        else:
            return f"奖项(level={award_level})"
    
    def search_contests(self, keyword: str) -> List[tuple]:
        results = []
        keyword_lower = keyword.lower()
        for idx, contest in enumerate(self.contests):
            if keyword_lower in contest['name'].lower():
                results.append((idx, contest))
        return results
    
    def search_schools(self, keyword: str) -> List[tuple]:
        results = []
        keyword_lower = keyword.lower()
        for school_id, school in self.school_map.items():
            if (keyword_lower in school['name'].lower() or 
                keyword_lower in school['province'].lower() or
                keyword_lower in school['city'].lower()):
                results.append((school_id, school))
        return results
    
    def search_provinces(self, keyword: str) -> List[str]:
        keyword_lower = keyword.lower()
        matched = [p for p in self.province_map.keys() if keyword_lower in p.lower()]
        return sorted(matched)
    
    def get_provinces(self) -> List[str]:
        return sorted(list(self.province_map.keys()))
    
    def match_award(self, record: Dict, contest_id: int, 
                    award_desc: Optional[str] = None, score: Optional[float] = None) -> bool:
        if record['contest_id'] != contest_id:
            return False
        
        # 如果指定了分数
        if score is not None:
            if abs(record['score'] - score) > 0.01:
                return False
        
        # 如果指定了奖项描述
        if award_desc:
            award_name = self.get_award_name(record['award_type'], record['award_level'])
            if award_desc not in award_name:
                return False
        
        return True
    
    def query(self, conditions: List[Dict], province: Optional[str] = None, 
              school_id: Optional[int] = None, name_abbr: Optional[str] = None,
              grade_mode: Optional[str] = None, grade_value: Optional[int] = None,
              grade_start: Optional[int] = None, grade_end: Optional[int] = None) -> List[Dict]:
        results = []
        
        for student in self.students:
            # 过滤姓名简称
            if name_abbr and student['abbr'] != name_abbr:
                continue
            
            # 过滤年级
            if grade_mode:
                try:
                    enroll_year = int(student['enroll_year'])
                    if grade_mode == 'single' and grade_value is not None:
                        if enroll_year != grade_value:
                            continue
                    elif grade_mode == 'range' and grade_start is not None and grade_end is not None:
                        if enroll_year < grade_start or enroll_year > grade_end:
                            continue
                except (ValueError, TypeError):
                    continue
            
            # 解析成绩记录
            records = self.parse_record(student['records'])
            
            # 检查是否满足所有条件（查询条件是学生获奖的子集）
            all_matched = True
            matched_records = []
            student_schools = set()
            student_provinces = set()
            
            for condition in conditions:
                contest_id = condition.get('contest_id')
                award = condition.get('award')
                score = condition.get('score')
                
                # 在该学生的记录中查找匹配的奖项
                found = False
                for record in records:
                    if self.match_award(record, contest_id, award, score):
                        # 获取学校信息
                        school = self.get_school_by_id(record['school_id'])
                        if school:
                            student_schools.add(school['name'])
                            student_provinces.add(school['province'])
                        
                        found = True
                        contest = self.get_contest_by_id(record['contest_id'])
                        matched_records.append({
                            'contest': contest['name'] if contest else '未知',
                            'year': contest['year'] if contest else 0,
                            'score': record['score'],
                            'rank': record['rank'],
                            'award': self.get_award_name(record['award_type'], record['award_level']),
                            'school': school['name'] if school else '未知'
                        })
                        break
                
                if not found:
                    all_matched = False
                    break
            
            # 检查省份过滤条件
            if province and province not in student_provinces:
                all_matched = False
            
            # 检查学校过滤条件
            if school_id is not None:
                # 检查该学生的获奖记录中是否有来自指定学校的
                has_school = any(record['school_id'] == school_id for record in records)
                if not has_school:
                    all_matched = False
            
            if all_matched and len(matched_records) == len(conditions):
                results.append({
                    'id': student['id'],
                    'name': student['name'],
                    'abbr': student['abbr'],
                    'enroll_year': student['enroll_year'],
                    'schools': list(student_schools),
                    'provinces': list(student_provinces),
                    'matched_awards': matched_records
                })
        
        return results


def interactive_query():
    print("=" * 80)
    print("OIerDb 交互式查询工具")
    print("=" * 80)
    print()
    
    # 初始化查询器
    query_tool = OIerQuery()
    
    # 收集查询条件
    conditions = []
    
    # 1. 添加奖项条件
    print("\n【步骤1】添加奖项条件")
    print("-" * 80)
    
    while True:
        print(f"\n当前已添加 {len(conditions)} 个奖项条件")
        add_more = input("是否添加奖项条件？(y/n): ").strip().lower()
        
        if add_more != 'y':
            break
        
        # 搜索比赛
        keyword = input("\n请输入比赛关键字（如: CSP2023, NOI2022）: ").strip()
        matches = query_tool.search_contests(keyword)
        
        if not matches:
            print("✗ 未找到匹配的比赛，请重新输入")
            continue
        
        print(f"\n找到 {len(matches)} 个匹配的比赛:")
        for idx, (contest_id, contest) in enumerate(matches):
            print(f"  [{idx}] ID:{contest_id} - {contest['name']} ({contest['year']}年)")
        
        try:
            choice = int(input(f"\n请选择比赛编号 [0-{len(matches)-1}]: ").strip())
            if choice < 0 or choice >= len(matches):
                print("✗ 无效的选择")
                continue
            
            selected_contest_id, selected_contest = matches[choice]
            
            # 输入奖项等级或分数
            print(f"\n已选择: {selected_contest['name']}")
            print("可选奖项: 金牌/银牌/铜牌（NOI/IOI），一等奖/二等奖/三等奖（CSP/NOIP）")
            award_input = input("请输入奖项等级（可选，直接回车跳过）: ").strip()
            
            score_input = input("请输入精确分数（可选，直接回车跳过）: ").strip()
            score = float(score_input) if score_input else None
            
            condition = {
                'contest_id': selected_contest_id,
                'contest_name': selected_contest['name'],
                'year': selected_contest['year']
            }
            
            if award_input:
                condition['award'] = award_input
            if score is not None:
                condition['score'] = score
            
            conditions.append(condition)
            print(f"✓ 已添加奖项条件: {selected_contest['name']} {award_input if award_input else ''} {score if score else ''}")
            
        except (ValueError, IndexError):
            print("✗ 输入错误，请重新输入")
            continue
    
    if not conditions:
        print("\n✗ 未添加任何奖项条件，退出查询")
        return
    
    # 2. 选择省份
    print("\n【步骤2】选择省份（可选）")
    print("-" * 80)
    
    province_filter = None
    use_province = input("是否按省份筛选？(y/n): ").strip().lower()
    
    if use_province == 'y':
        province_keyword = input("请输入省份关键字: ").strip()
        matched_provinces = query_tool.search_provinces(province_keyword)
        
        if matched_provinces:
            print(f"\n找到 {len(matched_provinces)} 个匹配的省份:")
            for idx, prov in enumerate(matched_provinces):
                print(f"  [{idx}] {prov}")
            
            try:
                choice = int(input(f"\n请选择省份编号 [0-{len(matched_provinces)-1}]: ").strip())
                if 0 <= choice < len(matched_provinces):
                    province_filter = matched_provinces[choice]
                    print(f"✓ 已选择省份: {province_filter}")
            except (ValueError, IndexError):
                print("✗ 输入错误，不使用省份筛选")
        else:
            print("✗ 未找到匹配的省份")
    
    # 3. 选择学校
    print("\n【步骤3】选择学校（可选）")
    print("-" * 80)
    
    school_filter = None
    use_school = input("是否按学校筛选？(y/n): ").strip().lower()
    
    if use_school == 'y':
        school_keyword = input("请输入学校关键字（名称/省份/城市）: ").strip()
        matched_schools = query_tool.search_schools(school_keyword)
        
        if matched_schools:
            print(f"\n找到 {len(matched_schools)} 所匹配的学校:")
            for idx, (school_id, school) in enumerate(matched_schools[:20]):  # 最多显示20个
                print(f"  [{idx}] ID:{school_id} - {school['name']} ({school['province']} {school['city']})")
            
            if len(matched_schools) > 20:
                print(f"  ... 还有 {len(matched_schools) - 20} 所学校未显示")
            
            try:
                choice = int(input(f"\n请选择学校编号 [0-{min(len(matched_schools)-1, 19)}]: ").strip())
                if 0 <= choice < len(matched_schools):
                    school_filter = matched_schools[choice][0]  # 获取 school_id
                    school_name = matched_schools[choice][1]['name']
                    print(f"✓ 已选择学校: {school_name}")
            except (ValueError, IndexError):
                print("✗ 输入错误，不使用学校筛选")
        else:
            print("✗ 未找到匹配的学校")
    
    # 4. 输入姓名简称
    print("\n【步骤4】选择年级或年级范围（可选）")
    print("-" * 80)
    
    grade_mode = None
    grade_value = None
    grade_start = None
    grade_end = None
    
    use_grade = input("是否按年级筛选？(y/n): ").strip().lower()
    
    if use_grade == 'y':
        mode_choice = input("选择筛选模式\n  [1] 单个年级\n  [2] 年级范围\n请输入 [1-2]: ").strip()
        
        if mode_choice == '1':
            grade_input = input("请输入入学年份（如: 2019）: ").strip()
            try:
                grade_value = int(grade_input)
                grade_mode = 'single'
                print(f"✓ 已设置年级: {grade_value}")
            except ValueError:
                print("✗ 输入错误，不使用年级筛选")
        elif mode_choice == '2':
            start_input = input("请输入起始年份（如: 2018）: ").strip()
            end_input = input("请输入结束年份（如: 2020）: ").strip()
            try:
                grade_start = int(start_input)
                grade_end = int(end_input)
                grade_mode = 'range'
                print(f"✓ 已设置年级范围: {grade_start} - {grade_end}")
            except ValueError:
                print("✗ 输入错误，不使用年级筛选")
    
    # 5. 输入姓名简称
    print("\n【步骤5】输入姓名简称（可选）")
    print("-" * 80)
    
    name_abbr = None
    use_name = input("是否按姓名简称筛选？(y/n): ").strip().lower()
    
    if use_name == 'y':
        name_abbr = input("请输入姓名简称（如: zxw）: ").strip()
        if name_abbr:
            print(f"✓ 已设置姓名简称: {name_abbr}")
    
    # 6. 执行查询
    print("\n【查询中】")
    print("=" * 80)
    
    results = query_tool.query(conditions, province=province_filter, 
                               school_id=school_filter, name_abbr=name_abbr,
                               grade_mode=grade_mode, grade_value=grade_value,
                               grade_start=grade_start, grade_end=grade_end)
    
    # 7. 显示结果
    print(f"\n找到 {len(results)} 名符合条件的学生")
    print("=" * 80)
    
    if results:
        for i, r in enumerate(results, 1):
            print(f"\n【{i}】{r['name']} ({r['abbr']}) - 入学年份: {r['enroll_year']}")
            if r['schools']:
                print(f"    学校: {', '.join(r['schools'])}")
            if r['provinces']:
                print(f"    省份: {', '.join(r['provinces'])}")
            print("    获奖记录:")
            for award in r['matched_awards']:
                print(f"      [{award['year']}] {award['contest']}: {award['award']} "
                      f"(分数: {award['score']}, 排名: {award['rank']}) - {award['school']}")
    else:
        print("\n未找到符合条件的学生")
    
    print("\n" + "=" * 80)


if __name__ == '__main__':
    interactive_query()