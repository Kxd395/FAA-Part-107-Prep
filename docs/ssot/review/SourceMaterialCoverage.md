# Source Material Coverage Review

- Source file: `docs/ssot/review/Source Material Needed for the FAA Part 107 Test.docx`
- Compared against: `packages/content/questions/*.json`
- Source questions parsed: **46**
- Strong matches (>=0.62): **21**
- Similar matches (0.46-0.61): **4**
- Weak/likely missing (<0.46): **21**

## Likely Covered (Examples)
- According to 14 CFR part 48, when would a person not be permitted to register a small UA? -> [REG-005] (Regulations)
- What is required to operate a small UA within 30 minutes after official sunset (civil twilight)? -> [REG-003] (Regulations)
- Which Category of small unmanned aircraft must have an airworthiness certificate issued by the FAA to operate over people? -> [REG-011] (Regulations)
- What must a person manipulating the controls of a small unmanned aircraft do if the standard remote identification fails during a flight? -> [REG-008] (Regulations)
- According to 14 CFR part 107, how may a remote pilot operate an unmanned aircraft in Class C airspace? -> [REG-001] (Regulations)
- The chart shows a gray line labeled "VR1667". Could this area present a hazard to the operations of a small UA? -> [AIR-005] (Airspace)
- How would a remote PIC "CHECK NOTAMS" as noted in a CAUTION box on a sectional chart regarding an unmarked balloon? -> [AIR-004] (Airspace)
- While monitoring the Cooperstown CTAF, you hear an aircraft announce that they are "midfield left downwind to RWY 13." Where would the aircraft be relative to the runway? -> [OPS-009] (Operations)
- What effect does high density altitude have on the efficiency of a UA propeller? -> [WX-002] (Weather)
- What are the typical characteristics of stable air? -> [WX-005] (Weather)
- What are the characteristics of a moist, unstable air mass? -> [WX-001] (Weather)
- You have received an outlook briefing indicating a low-level temperature inversion with high relative humidity. What weather conditions would you expect? -> [WX-006] (Weather)

## Weak Or Missing Candidates
| Source Question | Best Existing Match | Score |
|---|---|---:|
| Under what conditions must you report an accident caused by your drone to the FAA, and within how many days? | [REG-ACS-019] Which ACS knowledge code matches this topic: "Accident reporting."? | 0.21 |
| What is the minimum age to take the Part 107 Airman Knowledge Exam? | [REG-ACS-012] Under Part 107 ACS, which concept is covered by knowledge code UA.I.A.K1? | 0.35 |
| 14 CFR Part 91 requires that your blood alcohol level be less than: | [REG-148] According to 14 CFR part 107, what is the maximum altitude a small UAS is permitted to fly above ground level without a waiver? | 0.25 |
| Provided no property is carried for compensation or hire, an operator may fly a UAS from a moving vehicle if: | [REG-ACS-045] Which ACS knowledge code matches this topic: "Operating from a moving aircraft or moving land- or water-borne vehicle."? | 0.19 |
| Which of the following best describes a requirement for Category 1 sUAS operations over people? | [REG-ACS-029] Which ACS knowledge code matches this topic: "Requirement for the sUAS to be in a condition for safe operation."? | 0.27 |
| Which best describes a Declaration of Compliance (DOC)? | [REG-ACS-127] Which ACS knowledge code matches this topic: "Declaration of Compliance (DoC)."? | 0.39 |
| When is a Remote ID broadcast module required for a Part 107 operation? | [REG-001] According to 14 CFR part 107, how may a remote pilot operate an unmanned aircraft in Class C airspace? | 0.29 |
| Upon request by the FAA, the remote pilot-in-command must provide: | [REG-002] Which technique should a remote pilot use to scan for traffic? A remote pilot should | 0.35 |
| You plan to release golf balls from your small UA at an altitude of 100 feet AGL. You must ensure the objects being dropped will: | [OPS-010] To avoid a possible collision with a manned airplane, you estimate that your small UA climbed to an altitude greater than 600 feet AGL. To whom must you report the deviation? | 0.25 |
| Which of the following statements is true regarding FAA-Recognized Identification Areas (FRIAs)? | [OPS-017] Which is true regarding the presence of alcohol within the human body? | 0.23 |
| You have been hired to inspect the railroad tracks. Looking at the sectional chart, the entire route is outside of any magenta or blue borders. Will ATC authorization be required? | [AIR-054] On a sectional chart, what does a magenta vignette (shaded area) around an airport indicate? | 0.20 |
| What is the required flight visibility for a remote pilot operating an unmanned aircraft? | [REG-007] When may a remote pilot reduce the intensity of an aircraft's lights during a night flight? | 0.41 |
| You're hired to inspect a tower 4 NM southwest of Sioux Gateway airport. The tower is 402 ft AGL. What's the maximum altitude you are authorized to operate over the top of the tower? | [OPS-005] (Refer to FAA-CT-8080-2H, Figure 26, area 4.) You have been hired to inspect the tower under construction at 46.9N and 98.6W, near Jamestown Regional (JMS). What must you receive prior to flying your unmanned aircraft in this area? | 0.22 |
| You're hired to inspect a group of structures 9 miles south of an airport. The structure is 453 ft AGL. What's the highest you're allowed to fly? | [OPS-005] (Refer to FAA-CT-8080-2H, Figure 26, area 4.) You have been hired to inspect the tower under construction at 46.9N and 98.6W, near Jamestown Regional (JMS). What must you receive prior to flying your unmanned aircraft in this area? | 0.18 |
| Where would you go to obtain more information about restricted airspace R-2305? | [AIR-055] What type of special use airspace is designed for high-density student pilot training activity but is NOT classified as controlled or restricted airspace? | 0.21 |
| What does a red sign with white numbers indicate at an airport? | [AIR-054] On a sectional chart, what does a magenta vignette (shaded area) around an airport indicate? | 0.31 |
| You read a METAR report and the wind direction and velocity is listed as "18004KT". What does this indicate? | [WX-004] (Refer to FAA-CT-8080-2H, Figure 12.) The wind direction and velocity at KJFK is from | 0.38 |
| What hazard is most associated with a microburst? | [OPS-003] The most comprehensive information on a given airport is provided by | 0.17 |

## Notes
- Many weak matches are caused by ACS-code-only items in the bank (topic-code mapping questions) instead of direct operational scenario questions.
- Remote ID / OOP topics exist, but several are represented as ACS mapping prompts rather than exam-style scenario wording from the source document.
- Recommended next pass: add direct scenario-style questions for weak rows while keeping ACS-code items as supplemental.

## 2026-02-25 Coverage Update
- Added direct exam-style question entries to close high-priority weak rows:
  - `REG-151` minimum age for Part 107 test eligibility.
  - `REG-152` FAA accident reporting threshold and timing.
  - `REG-153` moving vehicle operation condition (`sparsely populated area`).
  - `REG-154` Declaration of Compliance (DoC) definition.
  - `REG-155` Remote ID broadcast module applicability.
  - `REG-156` records/credentials required upon FAA request.
  - `REG-157` minimum flight visibility requirement.
- Removed ACS code-mapping drill questions from the active bank (292 removed) because they are not direct FAA exam prompt format.
- Active direct exam-style bank now totals `77` questions (`66` confirmed real-test sourced + `11` supplemental direct scenario questions).
- Remaining weak candidates are primarily chart-specific and weather wording variants; those should be handled in the next direct-question batch.
