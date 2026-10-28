import { describe, expect, it } from "vitest";
import { readSkillFrontmatter } from "./skill-frontmatter";

const skill = (name: string) => `---\nname: ${name}\ndescription: Does a thing.\n---\n\n# Body\n`;

describe("readSkillFrontmatter", () => {
  it("accepts a name equal to the folder", () => {
    expect(readSkillFrontmatter(skill("poteto-mode"), "poteto-mode")).toEqual({ description: "Does a thing." });
  });

  it("accepts a display name that hyphenates to the folder", () => {
    expect(readSkillFrontmatter(skill("Poteto Mode"), "poteto-mode")).toEqual({ description: "Does a thing." });
  });

  it("rejects a different name", () => {
    expect(readSkillFrontmatter(skill("image-gen"), "chatcut-image-gen").problem).toBe("nameMismatch");
  });
});
