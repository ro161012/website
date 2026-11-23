export const HAC_SCHEDULE = `
<!doctype html>
<html>
  <head><title>Classes · Home Access Center</title></head>
  <body>
    <h1>Schedule</h1>
    <select
      id="ctl00_MainContent_MarkingPeriod"
      name="ctl00$MainContent$MarkingPeriod"
      onchange="javascript:__doPostBack('ctl00$MainContent$MarkingPeriod','')"
    >
      <option value="1">Marking Period 1</option>
      <option value="2" selected>Marking Period 2</option>
      <option value="3">Marking Period 3</option>
    </select>

    <div class="AssignmentClass">
      <div class="sg-header">
        <h2 class="sg-header-heading">AP English Language</h2>
        <span class="sg-header-heading">94.2</span>
        <span class="teacher">Elena Alvarez</span>
        <span class="room">A-112</span>
        <span class="period">1</span>
      </div>

      <table id="ctl00_MainContent_CourseCategories_0">
        <tbody>
          <tr><th>Category</th><th>Weight</th><th>Average</th></tr>
          <tr><td>Essays</td><td>50%</td><td>93.5%</td></tr>
          <tr><td>Practice</td><td>50%</td><td>92.5%</td></tr>
        </tbody>
      </table>

      <table id="ctl00_MainContent_CourseAssignments_0">
        <tbody>
          <tr><th>Assignment</th><th>Due</th><th>Category</th><th>Score</th><th>Status</th></tr>
          <tr>
            <td>Rhetorical analysis</td>
            <td>11/04/2026</td>
            <td>Essays</td>
            <td>94 / 100</td>
            <td>Graded</td>
          </tr>
          <tr>
            <td>Syntax check</td>
            <td>11/12/2026</td>
            <td>Practice</td>
            <td>M</td>
            <td>Missing</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="AssignmentClass">
      <div class="sg-header">
        <h2 class="sg-header-heading">Concert Band</h2>
        <span class="sg-header-heading">97</span>
      </div>
    </div>
  </body>
</html>
`;

export const HAC_ATTENDANCE = `
<!doctype html>
<html>
  <body>
    <table id="ctl00_MainContent_Attendance">
      <tbody>
        <tr><th>Date</th><th>Status</th><th>Course</th><th>Period</th></tr>
        <tr><td>11/02/2026</td><td>Present</td><td></td><td></td></tr>
        <tr><td>11/03/2026</td><td>Absent</td><td>AP Biology</td><td>3</td></tr>
        <tr><td>11/04/2026</td><td>Tardy</td><td>Precalculus</td><td>2</td></tr>
        <tr><td>11/05/2026</td><td>Excused</td><td></td><td></td></tr>
      </tbody>
    </table>
  </body>
</html>
`;

export const HAC_TRANSCRIPT = `
<!doctype html>
<html>
  <body>
    <div class="sg-transcript-gpa">Weighted 4.12 · Unweighted 3.78</div>
    <div class="class-rank">42 of 486</div>
    <table>
      <tbody>
        <tr><th>Course</th><th>Year</th><th>Term</th><th>Grade</th><th>Credits</th></tr>
        <tr><td>English 9 Honors</td><td>2024–2025</td><td>Full year</td><td>94</td><td>1</td></tr>
        <tr><td>Algebra I</td><td>2024–2025</td><td>Full year</td><td>91</td><td>1</td></tr>
      </tbody>
    </table>
  </body>
</html>
`;
