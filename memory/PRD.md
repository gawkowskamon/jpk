# JPK Converter Pro - PRD

## Problem Statement
Aplikacja do konwersji plików JPK_VAT na JPK_FA (polskie formaty XML do raportowania podatkowego).

## User Personas
- Księgowi i biura rachunkowe
- Specjaliści finansowi w firmach
- Osoby odpowiedzialne za sprawozdawczość VAT

## Core Requirements
1. Konwersja JPK_VAT → JPK_FA z prostą transformacją XML
2. Walidacja zgodności ze schematami XSD
3. Podgląd danych przed konwersją
4. Historia konwersji
5. Eksport do CSV/Excel
6. Obsługa starszych i najnowszych wersji JPK

## What's Been Implemented (2026-01-08)

### Backend (FastAPI)
- ✅ POST /api/preview - analiza pliku JPK_VAT, ekstrakcja faktur
- ✅ POST /api/convert - konwersja do JPK_FA z pobieraniem pliku
- ✅ GET /api/history - lista historii konwersji
- ✅ GET /api/export/{id} - eksport do XLSX lub CSV
- ✅ DELETE /api/history/{id} - usuwanie pojedynczej konwersji
- ✅ DELETE /api/history - czyszczenie całej historii

### Frontend (React)
- ✅ Dashboard - upload plików (drag & drop + formularz)
- ✅ Podgląd danych w tabeli przed konwersją
- ✅ Historia konwersji z wyszukiwaniem
- ✅ Eksport do Excel/CSV
- ✅ Strona ustawień
- ✅ Responsywny design (mobile + desktop)

### Design
- Kolorystyka: granatowy (#0F172A) + pomarańczowy (#F97316)
- Fonty: Manrope (nagłówki), Inter (treść), JetBrains Mono (kod)
- Komponenty Shadcn/UI

## Backlog

### P0 (Krytyczne)
- Wszystkie wymagane funkcje zaimplementowane ✅

### P1 (Ważne)
- Pełna walidacja schematów XSD (obecnie podstawowa)
- Obsługa większych plików (streaming)
- Podświetlanie błędów walidacji w podglądzie

### P2 (Przydatne)
- Batch processing (wiele plików naraz)
- Edycja danych przed konwersją
- Eksport do PDF
- Integracja z systemami ERP

## Next Tasks
1. Rozbudowa walidacji XSD
2. Dodanie statystyk podsumowujących na dashboard
3. Dodanie raportów porównawczych
