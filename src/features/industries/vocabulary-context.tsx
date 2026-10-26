"use client";
import { createContext, useContext } from "react";
import { standardVocabulary, type Vocabulary } from "./presets";
const Context = createContext<Vocabulary>(standardVocabulary);
export function VocabularyProvider({
  words,
  children,
}: {
  words: Vocabulary;
  children: React.ReactNode;
}) {
  return <Context.Provider value={words}>{children}</Context.Provider>;
}
export function useVocabulary() {
  return useContext(Context);
}
