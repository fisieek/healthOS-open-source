# Bezpieczeństwo

## O projekcie

healthOS to produkt w 100% powstały przy użyciu AI. Jest to aplikacja zbudowana
wyłącznie do użytku prywatnego. Nie jest to wyrób medyczny i nigdy nie powinna
zastąpić lekarza. W kwestiach medycznych służy wyłącznie jako wsparcie i historia
wizyt. Rozmowy z AI traktuj z dużą dozą rezerwy i wszystko weryfikuj z lekarzem.
Może służyć do rozwijania i inspiracji według własnych chęci i wizji.

Aplikacja z założenia działa lokalnie, na jednym komputerze, i nie jest wystawiona
do internetu.

## Model bezpieczeństwa - co warto wiedzieć

healthOS jest projektowany jako **aplikacja jednoosobowa uruchamiana lokalnie**.
Z tego wynika kilka rzeczy:

- **Baza nie jest szyfrowana.** To zwykły plik SQLite. Kto ma dostęp do Twojego
  konta w systemie, ma dostęp do danych. Jeśli to problem - włącz szyfrowanie dysku
  (FileVault, LUKS, BitLocker).
- **Pliki wgrane do aplikacji** leżą na dysku w postaci nieszyfrowanej.
- **Aplikacja nie jest przystosowana do wystawienia w internecie.** Nie ma
  ograniczania liczby żądań, audytu dostępu ani izolacji między użytkownikami na
  poziomie, jakiego wymagałaby usługa wielodostępna. Serwer nasłuchuje wyłącznie
  na `127.0.0.1`, więc z sieci lokalnej nie da się do niego dobić. Jeśli świadomie
  to zmienisz, robisz to na własne ryzyko.
- **Integracje wysyłają dane na zewnątrz.** Włączenie asystenta AI oznacza, że
  treść rozmowy i kontekst z Twoich danych trafiają do Google Gemini. Włączenie
  Google Calendar oznacza wysyłanie tam terminów wizyt. Każda integracja jest
  opcjonalna i domyślnie wyłączona.
- **Sekrety trzymaj w `.env.local`.** Ten plik jest w `.gitignore` i nigdy nie
  powinien trafić do repozytorium. Jeśli przypadkiem go wypchniesz - unieważnij
  wszystkie klucze, które w nim były, zanim zajmiesz się historią gita.
