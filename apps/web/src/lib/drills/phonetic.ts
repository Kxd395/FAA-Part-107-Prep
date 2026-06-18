import { shuffle, type ThreeChoiceQuestion } from "./threeChoice";

export interface PhoneticEntry {
  character: string;
  word: string;
  pronunciation: string;
  morse: string | null;
}

export const PHONETIC_ENTRIES: PhoneticEntry[] = [
  { character: "A", word: "Alfa", pronunciation: "AL FAH", morse: ".-" },
  { character: "B", word: "Bravo", pronunciation: "BRAH VOH", morse: "-..." },
  { character: "C", word: "Charlie", pronunciation: "CHAR LEE / SHAR LEE", morse: "-.-." },
  { character: "D", word: "Delta", pronunciation: "DELL TAH", morse: "-.." },
  { character: "E", word: "Echo", pronunciation: "ECK OH", morse: "." },
  { character: "F", word: "Foxtrot", pronunciation: "FOKS TROT", morse: "..-." },
  { character: "G", word: "Golf", pronunciation: "GOLF", morse: "--." },
  { character: "H", word: "Hotel", pronunciation: "HOH TEL", morse: "...." },
  { character: "I", word: "India", pronunciation: "IN DEE AH", morse: ".." },
  { character: "J", word: "Juliett", pronunciation: "JEW LEE ETT", morse: ".---" },
  { character: "K", word: "Kilo", pronunciation: "KEY LOH", morse: "-.-" },
  { character: "L", word: "Lima", pronunciation: "LEE MAH", morse: ".-.." },
  { character: "M", word: "Mike", pronunciation: "MIKE", morse: "--" },
  { character: "N", word: "November", pronunciation: "NO VEM BER", morse: "-." },
  { character: "O", word: "Oscar", pronunciation: "OSS CAH", morse: "---" },
  { character: "P", word: "Papa", pronunciation: "PAH PAH", morse: ".--." },
  { character: "Q", word: "Quebec", pronunciation: "KEH BECK", morse: "--.-" },
  { character: "R", word: "Romeo", pronunciation: "ROW ME OH", morse: ".-." },
  { character: "S", word: "Sierra", pronunciation: "SEE AIR RAH", morse: "..." },
  { character: "T", word: "Tango", pronunciation: "TANG GO", morse: "-" },
  { character: "U", word: "Uniform", pronunciation: "YOU NEE FORM / OO NEE FORM", morse: "..-" },
  { character: "V", word: "Victor", pronunciation: "VIK TAH", morse: "...-" },
  { character: "W", word: "Whiskey", pronunciation: "WISS KEY", morse: ".--" },
  { character: "X", word: "X-Ray", pronunciation: "ECKS RAY", morse: "-..-" },
  { character: "Y", word: "Yankee", pronunciation: "YANG KEY", morse: "-.--" },
  { character: "Z", word: "Zulu", pronunciation: "ZOO LOO", morse: "--.." },
  { character: "1", word: "One", pronunciation: "WUN", morse: ".----" },
  { character: "2", word: "Two", pronunciation: "TOO", morse: "..---" },
  { character: "3", word: "Three", pronunciation: "TREE", morse: "...--" },
  { character: "4", word: "Four", pronunciation: "FOW ER", morse: "....-" },
  { character: "5", word: "Five", pronunciation: "FIFE", morse: "....." },
  { character: "6", word: "Six", pronunciation: "SIX", morse: "-...." },
  { character: "7", word: "Seven", pronunciation: "SEV EN", morse: "--..." },
  { character: "8", word: "Eight", pronunciation: "AIT", morse: "---.." },
  { character: "9", word: "Nine", pronunciation: "NIN ER", morse: "----." },
  { character: "0", word: "Zero", pronunciation: "ZE RO", morse: "-----" },
  { character: ".", word: "Decimal", pronunciation: "DAY SEE MAL", morse: null },
  { character: "100", word: "Hundred", pronunciation: "HUN DRED", morse: null },
  { character: "1000", word: "Thousand", pronunciation: "TOU SAND", morse: null },
];

const LETTER_DISTRACTORS: Record<string, [string, string]> = {
  A: ["Atlas", "Arrow"],
  B: ["Beacon", "Boston"],
  C: ["Cobra", "Canyon"],
  D: ["Denver", "Dragon"],
  E: ["Eagle", "Engine"],
  F: ["Falcon", "Frontier"],
  G: ["Goal", "George"],
  H: ["Harbor", "Hunter"],
  I: ["Ivory", "Island"],
  J: ["Jupiter", "Jetstream"],
  K: ["King", "Kodiak"],
  L: ["Legend", "Liberty"],
  M: ["Matrix", "Mercury"],
  N: ["Neptune", "Nexus"],
  O: ["Orbit", "Oxford"],
  P: ["Pilot", "Phoenix"],
  Q: ["Quantum", "Quest"],
  R: ["Radar", "Rocket"],
  S: ["Signal", "Summit"],
  T: ["Thunder", "Titan"],
  U: ["Ultra", "Union"],
  V: ["Vector", "Voyager"],
  W: ["West", "Warden"],
  X: ["Xenon", "Xylophone"],
  Y: ["Yellow", "Yonder"],
  Z: ["Zebra", "Zenith"],
};

export function buildPhoneticQuestion(
  target: PhoneticEntry,
  pool: PhoneticEntry[]
): ThreeChoiceQuestion<PhoneticEntry> {
  const letterDistractors = LETTER_DISTRACTORS[target.character.toUpperCase()];
  if (letterDistractors) {
    return {
      item: target,
      prompt: `What is the NATO phonetic word for "${target.character}"?`,
      answer: target.word,
      options: shuffle([target.word, ...letterDistractors]),
    };
  }

  const targetIndex = pool.findIndex((entry) => entry.word === target.word);
  const distractorIndexes: number[] = [];
  let offset = 1;

  while (
    distractorIndexes.length < 2 &&
    (targetIndex - offset >= 0 || targetIndex + offset < pool.length)
  ) {
    if (targetIndex - offset >= 0) {
      distractorIndexes.push(targetIndex - offset);
    }
    if (distractorIndexes.length >= 2) break;
    if (targetIndex + offset < pool.length) {
      distractorIndexes.push(targetIndex + offset);
    }
    offset += 1;
  }

  const distractors = distractorIndexes
    .slice(0, 2)
    .map((index) => pool[index]?.word)
    .filter((word): word is string => !!word && word !== target.word);

  return {
    item: target,
    prompt: `What is the NATO phonetic word for "${target.character}"?`,
    answer: target.word,
    options: shuffle([target.word, ...distractors]),
  };
}
