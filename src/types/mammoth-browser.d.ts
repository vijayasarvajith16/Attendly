// Types for mammoth's prebuilt browser bundle, which has the same API as the
// main entry but needs no Node built-ins (used so .docx import runs on Hermes).

declare module 'mammoth/mammoth.browser' {
  import mammoth from 'mammoth';
  export default mammoth;
}
