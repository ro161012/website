import { describe, expect, it } from "vitest";
import {
  findExplicitStudentName,
  isLoginPage,
  namesMatch,
  parseStudentChoices,
} from "@/lib/hac/auth";
import { DEFAULT_PROFILE } from "@/lib/hac/profiles";

const PICKER = `
  <html><body>
    <div class="sg-student-picker">
      <div class="sg-student-picker-row">
        <input type="radio" name="studentId" value="student-2">
        <label>Jordan Ellis</label>
        <span>Grade 11</span>
      </div>
      <div class="sg-student-picker-row">
        <input type="radio" name="studentId" value="student-1">
        <label>Avery Ellis</label>
        <span>Grade 9</span>
      </div>
    </div>
    <span id="studentName">Jordan Ellis</span>
  </body></html>
`;

describe("HAC auth helpers", () => {
  it("parses student rows and keeps ids stable when row order changes", () => {
    const choices = parseStudentChoices(PICKER, DEFAULT_PROFILE);
    expect(choices.map((choice) => choice.student.displayName)).toEqual([
      "Jordan Ellis",
      "Avery Ellis",
    ]);
    expect(choices.map((choice) => choice.rowValue)).toEqual([
      "student-2",
      "student-1",
    ]);
    expect(new Set(choices.map((choice) => choice.student.id)).size).toBe(2);

    const reversed = parseStudentChoices(
      PICKER.replace(
        /<div class="sg-student-picker-row">[\s\S]*?<\/div>\s*<div class="sg-student-picker-row">[\s\S]*?<\/div>/,
        `<div class="sg-student-picker-row">
          <input type="radio" name="studentId" value="student-1">
          <label>Avery Ellis</label>
        </div>
        <div class="sg-student-picker-row">
          <input type="radio" name="studentId" value="student-2">
          <label>Jordan Ellis</label>
        </div>`,
      ),
      DEFAULT_PROFILE,
    );
    expect(reversed[0]?.student.id).toBe(choices[1]?.student.id);
    expect(reversed[1]?.student.id).toBe(choices[0]?.student.id);
  });

  it("reads an explicit student name and compares names conservatively", () => {
    expect(findExplicitStudentName(PICKER)).toBe("Jordan Ellis");
    expect(findExplicitStudentName("<html><title>Classes</title></html>")).toBeNull();
    expect(namesMatch("Jordan Ellis", "Jordan Ellis — Grade 11")).toBe(true);
    expect(namesMatch("Jordan Ellis", "Avery Ellis")).toBe(false);
  });

  it("treats only a password field as a login page", () => {
    expect(isLoginPage('<form><input type="password" name="pw"></form>')).toBe(true);
    expect(isLoginPage("<p>Login failed</p>")).toBe(false);
  });

  it("fails closed on a multi-student dropdown", () => {
    const dropdown = `
      <select name="studentId">
        <option value="1">Jordan</option>
        <option value="2">Avery</option>
      </select>`;
    expect(() => parseStudentChoices(dropdown, DEFAULT_PROFILE)).toThrow(
      /student dropdown/i,
    );
  });
});
