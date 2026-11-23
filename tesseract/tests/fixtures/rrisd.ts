export const RRISD_CLASSWORK = `
<!doctype html>
<html>
  <body class="sg-hac-legacy">
    <form id="fmMain" action="./Assignments.aspx" method="post">
      <select id="plnMain_ddlReportCardRuns" name="ctl00$plnMain$ddlReportCardRuns">
        <option value="ALL">(All Runs)</option>
        <option value="1-2027">1</option>
        <option value="2-2027" selected>2</option>
        <option value="3-2027">3</option>
        <option value="4-2027">4</option>
      </select>

      <div id="plnMain_pnlFullPage" class="sg-content-grid">
        <div class="AssignmentClass">
          <div class="sg-header sg-header-square">
            <button id="plnMain_rptAssigmnetsByCourse_btnShowHide_0"></button>
            <a class="sg-header-heading" href="#">TAG/Advanced English II</a>
            <span class="sg-header-sub-heading">Last Updated 11/20/2026</span>
            <span
              id="plnMain_rptAssigmnetsByCourse_lblHdrAverage_0"
              class="sg-header-heading sg-right"
            >94.2</span>
          </div>

          <div class="sg-content-grid">
            <table
              id="plnMain_rptAssigmnetsByCourse_dgCourseCategories_0"
              class="sg-asp-table"
            >
              <tbody>
                <tr class="sg-asp-table-header-row">
                  <td>Category</td>
                  <td>Student's Points</td>
                  <td>/ Maximum Points</td>
                  <td>= Percent</td>
                  <td>* Category Weight</td>
                  <td>= Category Points</td>
                </tr>
                <tr>
                  <td>Formative</td><td>45</td><td>50</td><td>90%</td><td>0.6</td><td>54</td>
                </tr>
                <tr>
                  <td>Summative</td><td>36</td><td>40</td><td>90%</td><td>0.4</td><td>36</td>
                </tr>
                <tr>
                  <td>Total Points:</td><td>81</td><td>90</td><td>90%</td><td>1</td><td>90</td>
                </tr>
              </tbody>
            </table>

            <table
              id="plnMain_rptAssigmnetsByCourse_dgCourseAssignments_0"
              class="sg-asp-table"
            >
              <tbody>
                <tr class="sg-asp-table-header-row">
                  <td>Date Due</td>
                  <td>Date Assigned</td>
                  <td>Assignment</td>
                  <td>Category</td>
                  <td>Score</td>
                  <td>Total Points</td>
                  <td>Weight</td>
                  <td>Weighted Score</td>
                  <td>Weighted Total Points</td>
                </tr>
                <tr>
                  <td>11/04/2026</td>
                  <td>10/28/2026</td>
                  <td>Rhetorical analysis</td>
                  <td>Formative</td>
                  <td>45</td>
                  <td>50</td>
                  <td>100</td>
                  <td>45</td>
                  <td>50</td>
                </tr>
                <tr>
                  <td>11/12/2026</td>
                  <td>11/05/2026</td>
                  <td>Syntax check</td>
                  <td>Summative</td>
                  <td>M</td>
                  <td>10</td>
                  <td>100</td>
                  <td>0</td>
                  <td>10</td>
                </tr>
                <tr>
                  <td>11/18/2026</td>
                  <td>11/10/2026</td>
                  <td>Poetry response</td>
                  <td>Formative</td>
                  <td>18 / 20</td>
                  <td>20</td>
                  <td>100</td>
                  <td>90</td>
                  <td>20</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="AssignmentClass">
          <div class="sg-header sg-header-square">
            <a class="sg-header-heading" href="#">TAG/AP Statistics</a>
            <span
              id="plnMain_rptAssigmnetsByCourse_lblHdrAverage_1"
              class="sg-header-heading sg-right"
            >88.6</span>
          </div>
        </div>
      </div>
    </form>
  </body>
</html>
`;

export const RRISD_ATTENDANCE = `
<!doctype html>
<html>
  <body>
    <table id="plnMain_cldAttendance" class="sg-asp-calendar">
      <tbody>
        <tr>
          <td>
            <table class="sg-asp-calendar-header">
              <tr><td><<</td><td>November 2026</td><td>>></td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th>
        </tr>
        <tr>
          <td></td><td></td><td></td>
          <td>3</td>
          <td class="sg-asp-calendar-absent">4</td>
          <td>5 Tardy</td>
          <td>6</td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`;

export const RRISD_REPORT_CARD = `
<!doctype html>
<html>
  <body>
    <table id="plnMain_dgReportCard" class="sg-asp-table">
      <tbody>
        <tr class="sg-asp-table-header-row">
          <td>Course</td><td>Description</td><td>Periods</td><td>Teacher</td>
          <td>Room</td><td>Att.Credit</td><td>Ern. Credit</td><td>MP1</td>
          <td>COM1</td><td>COM2</td><td>TARDY</td><td>EXAB</td>
        </tr>
        <tr>
          <td>1125A</td><td>TAG/Advanced English II</td><td>1</td>
          <td>Elena Alvarez</td><td>A-112</td><td>1</td><td>1</td><td>95</td>
          <td></td><td></td><td>0</td><td>0</td>
        </tr>
        <tr>
          <td>1125A</td><td>TAG/Advanced English II</td><td>1</td>
          <td>Elena Alvarez</td><td>A-112</td><td>1</td><td>0</td><td></td>
          <td></td><td></td><td>0</td><td>0</td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`;

export const RRISD_TRANSCRIPT = `
<!doctype html>
<html>
  <body>
    <table>
      <tbody>
        <tr><td>Year:</td><td>2025-26</td><td></td><td></td><td>Grade:</td><td>09</td></tr>
      </tbody>
    </table>
    <table id="plnMain_rpTranscriptGroup_dgCourses_0" class="sg-asp-table">
      <tbody>
        <tr>
          <td>Course</td><td>Description</td><td>SEM1</td><td>SEM2</td><td>Final</td><td>Credit</td>
        </tr>
        <tr>
          <td>1125A</td><td>TAG/Advanced English II</td><td>94</td><td>96</td><td>95</td><td>1</td>
        </tr>
        <tr>
          <td>3606A</td><td>TAG/AP Statistics</td><td>90</td><td>92</td><td>91</td><td>1</td>
        </tr>
      </tbody>
    </table>
    <table>
      <tbody>
        <tr><td></td><td></td><td>Total Credit:</td><td>2.0000</td></tr>
      </tbody>
    </table>
    <div>Weighted GPA: 4.12 · Unweighted GPA: 3.78</div>
    <div>Class Rank: 10 of 500</div>
  </body>
</html>
`;
