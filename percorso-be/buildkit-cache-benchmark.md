# BuildKit Cache Benchmark

## Prima Build (Senza Cache)
- Tempo impiegato: 
real    0m18.880s
user    0m0.106s
sys     0m0.137s
- Comportamento: npm ha dovuto scaricare tutti i pacchetti dal registry remoto.

## Seconda Build (Con Cache BuildKit in /root/.npm)
- Tempo impiegato: 
real    0m4.738s
user    0m0.121s
sys     0m0.106s
- Comportamento: npm ha utilizzato la cache locale montata da BuildKit, velocizzando drasticamente l'installazione delle dipendenze nonostante il layer Docker classico fosse stato invalidato.