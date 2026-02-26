# Combined Question Bank Dedupe Report

Generated: 2026-02-26

## Inputs
- part107_question_bank.json: 100 questions
- carrington_question_bank.strict.json: 103 questions

## Output
- combined_question_bank.json: 112 questions

## Inclusion policy
Base bank is 100% of Part 107 questions. From Carrington, only items that add coverage (NOTAM/TFR basics and a trimmed set of METAR/TAF code decoding questions) were included. Everything else was excluded as redundant, out of scope for the UAG exam style, or inaccurate/outdated.

## Text normalization
Selected Carrington questions contained escaped quotes and apostrophes (for example \"BKN\" and FAA\'s). In the combined bank these were normalized to plain quotes/apostrophes for cleaner UI rendering.

## Carrington questions included
The following Carrington question IDs were imported and assigned new IDs in the combined bank:

| combined_id | carrington_id | topic | question |
|---:|---:|---|---|
| 101 | 31 | Airspace | How can drone operators access NOTAMs which provide important safety information about potential hazards along a flight route? |
| 102 | 32 | Airspace | What does a Temporary Flight Restriction (TFR) typically indicate for drone operations? |
| 103 | 36 | Airspace | What is the primary hazard of flying a drone in an area with active Temporary Flight Restrictions (TFRs) without permission? |
| 104 | 46 | Weather | When interpreting a METAR, what does the term "BKN" signify in the context of cloud cover? |
| 105 | 47 | Weather | If a TAF report indicates "TSRA", what should a drone operator anticipate? |
| 106 | 48 | Weather | How does a drone operator interpret a METAR that includes "27015G25KT" regarding wind conditions? |
| 107 | 49 | Weather | What does a visibility notation of "1/2SM" in a METAR suggest for drone flying conditions? |
| 108 | 50 | Weather | In a TAF report, what does the term "PROB40" indicate? |
| 109 | 53 | Weather | A TAF includes "TEMPO 1214 3SM BR". What should a drone operator expect? |
| 110 | 54 | Weather | What implications does "P6SM" have for drone operations in a TAF report? |
| 111 | 56 | Weather | What does the encoding "SCT030" in a TAF report imply about the cloud coverage? |
| 112 | 58 | Weather | A METAR includes "HZ" in its weather phenomena section. What does this signify, and what is its relevance to drone flying? |

## Carrington questions excluded: inaccurate or outdated
Excluded count: 11

- Carrington 12: Which FAA form is used for drone registration under Part 107?
- Carrington 14: What type of operations would typically require a waiver from the FAA under Part 107?
- Carrington 15: Under what circumstances can a drone pilot operate over moving vehicles under Part 107?
- Carrington 17: Which condition does not require a drone to be registered under Part 107?
- Carrington 21: Which of the following activities under FAA Part 107 requires a drone to be registered with the FAA?
- Carrington 27: What is the FAA's requirement for communicating a drone's registration number during an operation under Part 107?
- Carrington 40: What procedure should a drone operator follow if operating within 5 miles of an airport not covered by LAANC?
- Carrington 44: Under what condition can a drone fly over a crowd under FAA Part 107 rules?
- Carrington 62: What is the most effective way to handle a sudden loss of visual line of sight (VLOS) due to fog?
- Carrington 73: Which FAA regulation directly addresses the prohibition of drug use that impairs faculties contrary to safety in UAS operations?
- Carrington 86: What FAA regulation prohibits UAS operators from performing duties within 8 hours of consuming alcohol?

## Carrington questions excluded: out of scope for this Part 107 knowledge-test bank
Excluded count: 24

- Carrington 63: When communicating with Air Traffic Control (ATC), what information should be provided during the initial contact?
- Carrington 64: How should a UAS operator handle instructions received from ATC that are not clearly understood?
- Carrington 65: In the context of UAS operations, what is the significance of the command "Standby" from ATC?
- Carrington 66: What should a drone operator do if they receive conflicting instructions from two different ATC sources?
- Carrington 67: How should UAS operators handle the communication after completing a readback with ATC?
- Carrington 68: In UAS operations, what is the primary purpose of using the "readback" procedure in communications with ATC?
- Carrington 69: What is the most effective way to ensure clarity when communicating with ATC in a noisy environment?
- Carrington 70: What should a drone operator do if they receive conflicting instructions from different ATC units?
- Carrington 75: What type of drug testing circumstances might a UAS operator be subjected to under FAA regulations?
- Carrington 77: Which FAA initiative aims to prevent substance abuse among UAS operators by providing educational resources?
- Carrington 81: Under FAA regulations, which type of drug testing is mandatory following any aviation accident involving a UAS?
- Carrington 82: What is the primary purpose of the FAA's reasonable suspicion drug testing for UAS operators?
- Carrington 83: How does the FAA recommend UAS operators prepare for compliance with substance abuse regulations?
- Carrington 84: Which FAA-supported initiative provides resources and support specifically for aviation professionals dealing with substance dependency?
- Carrington 85: What are the consequences for a UAS operator who fails a drug test under FAA regulations?
- Carrington 88: When can a UAS operator be subjected to random drug testing under FAA regulations?
- Carrington 89: What is the primary focus of FAA educational programs on substance abuse for UAS operators?
- Carrington 90: How does the FAA enforce compliance with drug and alcohol regulations among UAS operators?
- Carrington 91: What is an example of a behavior that may trigger reasonable suspicion testing under FAA guidelines?
- Carrington 92: What is the consequence of a UAS operator violating FAA drug and alcohol regulations during an operation that results in an accident?
- Carrington 94: What is the role of air traffic control (ATC) in UAS operations near airports?
- Carrington 96: Which statement best describes the role of air traffic control (ATC) in relation to UAS operations near airports?
- Carrington 98: Why must UAS operators establish communication with local ATC when planning to fly near airports?
- Carrington 103: How should UAS operators respond if they encounter communication failures with ATC during a flight near an airport?

## Carrington questions excluded: redundant with Part107 bank coverage
Excluded count: 56

These questions may be fine for practice, but they overlap topics already covered by part107_question_bank.json or are phrased less cleanly than the Part 107 versions.

IDs excluded as redundant:
1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 16, 18, 19, 20, 22, 23, 24, 25, 26, 28, 29, 30, 33, 34, 35, 37, 38, 39, 41, 42, 43, 45, 51, 52, 55, 57, 59, 60, 61, 71, 72, 74, 76, 78, 79, 80, 87, 93, 95, 97, 99, 100, 101, 102

## Notes on image-based items
All Part107 image-based questions remain in the combined bank unchanged (Part107 IDs 67, 68, 69, 70, 71, 99, 100). Ensure your image wiring continues to use part107_images_needed.json.