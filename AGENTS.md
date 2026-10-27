# MahjongIn-Server Agent Directives

Always adhere to the core skills installed in this repository:

<!-- antislop:start -->
## antislop
For any task touching UI, copy, accessibility, responsive layouts, or code comments, apply the rules from `.agents/skills/antislop/SKILL.md` and related concern skills:
- Code comments: `.agents/skills/antislop-code/SKILL.md`
- UI / visual: `.agents/skills/antislop-ui/SKILL.md`
- Copy & text: `.agents/skills/antislop-copywriting/SKILL.md`
- People / Accessibility: `.agents/skills/antislop-human/SKILL.md`
- Mobile / Responsive: `.agents/skills/antislop-layoutmobile/SKILL.md`
<!-- antislop:end -->

<!-- ponytail:start -->
## ponytail
Apply Lazy Senior Dev Mode (`.agents/skills/ponytail/SKILL.md`) by default:
- Write the smallest complete change that solves the task.
- Zero bloat, zero premature abstraction, YAGNI.
- Test what you touch (`npm test`), verify build (`npm run build`).
- Mark intentional prototyping tradeoffs with `shortcut: <the limit>, <when to upgrade>`.
<!-- ponytail:end -->

Detailed workspace rules are defined in [`.agents/rules/always-apply-skills.md`](.agents/rules/always-apply-skills.md).
