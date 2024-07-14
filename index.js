import fs from "fs";

const FILE = process.argv[2];
console.log(`Assembling ${FILE}`)

const INSTRUCTIONS = [
  "add",
  "sub",
  "addi",
  "addu",
  "subu",
  "mul",
  "mult",
  "div",
  "and",
  "or",
  "andi",
  "ori",
  "sli",
  "sri",
  "lw",
  "sw",
  "lui",
  "mfhi",
  "mflo",
  "move",
  "beq",
  "bne",
  "slt",
  "slti",
  "j",
  "jr",
  "jal",
  "syscall"
];

const PSEUDO_INSTRUCTIONS = ["la", "li", "move", "bgt", "bge", "blt", "ble"];

const REG_MAP = [
  "$zero",
  "$at",
  "$v0",
  "$v1",
  "$a0",
  "$a1",
  "$a2",
  "$a3",
  "$t0",
  "$t1",
  "$t2",
  "$t3",
  "$t4",
  "$t5",
  "$t6",
  "$t7",
  "$t8",
  "$t9",
  "$s0",
  "$s1",
  "$s2",
  "$s3",
  "$s4",
  "$s5",
  "$s6",
  "$s7",
  "",
  "",
  "",
  "",
  "",
  "$ra"
];

function instructionToDesmos(str) {
  return str[0] + (str[1] ? `_{${str.slice(1, str.length)}}` : "");
}

function generatePiecewiseForInstructions() {
  let mapped = INSTRUCTIONS.map(instructionToDesmos);
  let strFinal = `{I=0:${mapped[0]},`;
  mapped.forEach((str, i) => {
    strFinal += `,I=${i}:${str}`;
  });
  strFinal += "}";
}

function generateLabelStuff() {
  let mapped = INSTRUCTIONS.map(instructionToDesmos);
  let strFinal = "";
  mapped.forEach((str, i) => {
    strFinal += `\np_{ts}[N[r_{om}[4N+1]=${i}]]`;
  });
  return strFinal;
}

generatePiecewiseForInstructions();

const data = fs.readFileSync(FILE).toString();
// For now I'm gonna do a very basic assembler w/o directives, just for testing
const dataAr = data
  .toLowerCase()
  .replaceAll(/^\s+/gm, "")
  .replaceAll(/\s + (?=\n)/gm, "")
  .replaceAll("\r", "")
  .split("\n")
  .map((str) => {
    return {
      inst: (str.match(/^[^\s]+/gm) || [])[0], // This is horrible, but it works
      args: str.match(/(?<=\s|,)[^\s,]+/gm)
    };
  });
let instOnly = dataAr.map((a) => a.inst);
// Data section (if exists)
let dataSectionIndex = instOnly.indexOf(".data");
if (dataSectionIndex < 0) {
  dataSectionIndex = 0;
  console.log("WARNING: .data section not found, ignoring...");
}
let textSectionIndex = instOnly.indexOf(".text");
if (textSectionIndex < 0)
  throw new Error(".text section not found, no code in program?");

function getInst(s) {
  return INSTRUCTIONS.indexOf(s);
}

function getReg(s) {
  return REG_MAP.indexOf(s);
}

function setMemAddress(a, v) {
  return `${getInst("ori")},${getReg("$t0")},${getReg("$zero")},${v},${getInst(
    "sw"
  )},${getReg("$t0")},${getReg("$zero")},${a},`;
}

function toTwosComplement(v) {
  let nv = (~v + 1) % 2 ** 32;
  if (nv < 0) nv += 2 ** 32;
  return nv;
}

let finalString = "[";
let memoryAddressDict = {};

let pc = 0;

if (dataSectionIndex !== textSectionIndex) {
  let dataSectionAr = dataAr.slice(dataSectionIndex, textSectionIndex);
  let memAddress = 0;
  dataSectionAr.forEach((dataThing, i) => {
    if (!dataThing.inst) return;
    let type = dataThing.inst;
    if (type.startsWith(";") || [".data", ".text"].includes(type)) return;
    let label = null;
    if (type.endsWith(":")) {
      label = type.slice(0, type.length - 1);
      memoryAddressDict[label] = memAddress;
      if (!dataThing.args) return;
      type = dataThing.args[0];
      dataThing.args = dataThing.args.slice(1, dataThing.args.length);
    }
    let args = dataThing.args;
    if (!args) throw new Error("Invalid data header on line " + i);
    let bitWidth; // "Unexpected lexical declaration in switch statement" nerd emoji
    let str;
    switch (type) {
      case ".word":
        bitWidth = 32;
      // Falls through
      case ".half":
        bitWidth = bitWidth ?? 16;
      // Falls through
      case ".byte":
        bitWidth = bitWidth ?? 8;
        args.forEach((val) => {
          // Todo: this doesn't actually account for the different max and min from two's complement. Too bad!
          if (Math.abs(val) > 2 ** (bitWidth - 1))
            throw new Error(
              "Attempted to write a value that's too large for " +
              bitWidth +
              " bits at line " +
              i
            );
          let fVal;
          if (val[0] === "s") {
            fVal = toTwosComplement(parseInt(val.slice(1, val.length)));
          } else fVal = parseInt(val);
          if (isNaN(fVal))
            throw new Error("Invalid data at line " + i + ": " + val[0]);
          finalString += setMemAddress(memAddress, fVal);
          memAddress++;
          pc += 8;
        });
        break;
      case ".ascii":
        console.log(
          "WARNING: .ascii USED, WHICH DIFFERS SLIGHTLY FROM SPEC - MEMORY IS IN 32b BLOCKS, SO ASCII WILL BE IN 32b BLOCKS, WHICH WILL NOT WORK AS NORMAL"
        );
        str = args.join("");
        if (!str.startsWith('"') || !str.endsWith('"'))
          console.log(
            "Invalid string at line " +
            i +
            ": " +
            str +
            ", fixing, assuming missing quotes"
          );
        str = str.replaceAll(/^"|"$/gm, "");
        for (let i = 0; i < str.length; i++) {
          finalString += setMemAddress(memAddress, str.charCodeAt(i));
          memAddress++;
          pc += 8;
        }
        break;
      case ".asciiz":
        console.log(
          "WARNING: .ascii USED, WHICH DIFFERS SLIGHTLY FROM SPEC - MEMORY IS IN 32b BLOCKS, SO ASCII WILL BE IN 32b BLOCKS, WHICH WILL NOT WORK AS NORMAL"
        );
        str = args.join("");
        if (!str.startsWith('"') || !str.endsWith('"'))
          console.log(
            "Invalid string at line " +
            i +
            ": " +
            str +
            ", fixing, assuming missing quotes"
          );
        str = str.replaceAll(/^"|"$/gm, "");
        for (let i = 0; i < str.length; i++) {
          finalString += setMemAddress(memAddress, str.charCodeAt(i));
          memAddress++;
          pc += 8;
        }
        finalString += setMemAddress(memAddress, str.charCodeAt(i));
        memAddress++;
        pc += 8;
        break;
      case ".space":
        bitWidth = parseInt(args[0]);
        if (isNaN(bitWidth))
          throw new Error("Invalid space length on line " + i + ": " + args[0]);
        if (bitWidth % 4 !== 0)
          throw new Error(
            "Invalid space size on index " +
            i +
            ": " +
            args[0] +
            " - this is different from spec, must align to word boundaries"
          );
        memAddress += bitWidth / 4;
        break;
      case ".align":
        bitWidth = parseInt(args[0]);
        if (isNaN(bitWidth))
          throw new Error("Invalid align index on line " + i + ": " + args[0]);
        if (bitWidth % 4 !== 0)
          throw new Error(
            "Invalid align index on index " +
            i +
            ": " +
            args[0] +
            " - this is different from spec, must align to word boundaries"
          );
        memAddress = bitWidth / 4;
        break;
    }
  });
  finalString += "10,8,8,0,";
}


let textSectionAr = dataAr.slice(textSectionIndex, dataAr.length);

// Convert pseudo-instructions
let safety = 0;
let index = textSectionAr.findIndex((a) =>
  PSEUDO_INSTRUCTIONS.includes(a.inst)
);

// const PSEUDO_INSTRUCTIONS = ["la", "li", "move", "bgt", "bge", "blt", "ble"];
while (safety < 10000 && index >= 0) {
  let inst = textSectionAr[index];
  let args = inst.args;
  let id = PSEUDO_INSTRUCTIONS.indexOf(inst.inst);
  switch (id) {
    case 0:
    // LA
    // Falls through
    case 1:
      // LI
      textSectionAr.splice(index, 1, {
        inst: "addi",
        args: [args[0], "$zero", args[1]]
      });
      break;
    case 2:
      // MOVE
      textSectionAr.splice(index, 1, {
        inst: "add",
        args: [args[1], "$zero", args[0]]
      });
      break;
    case 3:
      // BGT
      console.log(
        "WARNING: BGT USED. BGT IS NOT SUPPORTED BC I CBA IMPLEMENTING RN..."
      );
      break;
    case 4:
      // BGE
      textSectionAr.splice(index, 1, {
        inst: "slt",
        args: ["$at", args[0], args[1]]
      });
      textSectionAr.splice(index + 1, 0, {
        inst: "beq",
        args: ["$at", "$zero", args[2]]
      });
      break;
    case 5:
      // BLT
      textSectionAr.splice(index, 1, {
        inst: "slt",
        args: ["$at", args[0], args[1]]
      });
      textSectionAr.splice(index + 1, 0, {
        inst: "bne",
        args: ["$at", "$zero", args[2]]
      });
      break;
    case 6:
      // BLE
      console.log(
        "WARNING: BLE USED. BGT IS NOT SUPPORTED BC I CBA IMPLEMENTING RN..."
      );
      break;
  }
  safety++;
  index = textSectionAr.findIndex((a) => PSEUDO_INSTRUCTIONS.includes(a.inst));
}

// Set up labels
let labelDict = {};

textSectionAr.forEach((instruction, i) => {
  if (!instruction.inst) return;
  let inst = instruction.inst;
  if (inst.startsWith(";") || inst.startsWith(".")) return;
  if (inst.endsWith(":")) {
    let label = inst.slice(0, inst.length - 1);
    if (
      labelDict[label] !== undefined ||
      memoryAddressDict[label] !== undefined
    )
      throw new Error("Duplicate label on line " + i + ": " + label);
    labelDict[label] = pc;
  } else pc += 4;
});


textSectionAr.forEach((instruction, index) => {
  if (!instruction.inst) return;
  let inst = instruction.inst;
  let args = instruction.args ?? [];
  if (inst.startsWith(";") || inst.endsWith(":") || inst.startsWith("."))
    return;
  let id = INSTRUCTIONS.indexOf(inst);
  if (id < 0)
    throw new Error("Invalid instruction on line " + index + ": " + inst);
  finalString += `${id},`;
  for (let i = 0; i < args.length; i++) {
    let argVal;
    if (args[i].startsWith("$")) {
      argVal = REG_MAP.indexOf(args[i]);
      if (argVal < 0) {
        throw new Error("Invalid argument on line " + index + ": " + args[i]);
      }
    } else if (args[i].startsWith("s"))
      argVal = toTwosComplement(parseInt(args[i].slice(1, args[i].length)));
    else {
      argVal = parseInt(args[i]);
      argVal = isNaN(argVal)
        ? labelDict[args[i]] ?? memoryAddressDict[args[i]]
        : argVal;
      if (isNaN(argVal)) {
        throw new Error("Invalid argument on line " + index + ": " + args[i]);
      }
    }
    finalString += `${argVal},`;
  }
  finalString += "0,".repeat(3 - args.length);
});
console.log(finalString.slice(0, finalString.length - 1) + "]");
