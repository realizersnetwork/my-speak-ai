# 데이터베이스 격리 수준 (Isolation Levels)

데이터베이스 격리 수준은 여러 트랜잭션이 동시에 실행될 때 서로의 작업이 어떻게 보이는지를 정하는 규칙입니다.
격리 수준이 낮을수록 동시성은 높아지지만 데이터 이상 현상이 생길 수 있고,
격리 수준이 높을수록 일관성은 좋아지지만 성능(동시성)은 떨어질 수 있습니다.

## 왜 필요한가
동시에 여러 사용자가 같은 데이터를 읽고 쓰면 Dirty Read, Non-Repeatable Read, Phantom Read 같은 문제가 발생할 수 있습니다.
격리 수준은 이러한 문제를 어느 정도까지 허용할지 결정합니다.

## 1. READ UNCOMMITTED
가장 낮은 격리 수준입니다.
다른 트랜잭션이 아직 커밋하지 않은 데이터도 읽을 수 있습니다.
Dirty Read(더티 리드)가 발생할 수 있어 실무에서는 거의 사용하지 않습니다.

## 2. READ COMMITTED
커밋된 데이터만 읽을 수 있습니다.
Dirty Read는 방지되지만, 같은 쿼리를 두 번 실행했을 때 결과가 달라질 수 있는 Non-Repeatable Read가 발생할 수 있습니다.
Oracle 등 많은 DBMS의 기본 격리 수준입니다.

## 3. REPEATABLE READ
한 트랜잭션 안에서 같은 데이터를 반복해서 읽어도 같은 결과가 보장됩니다.
Non-Repeatable Read는 방지되지만, 범위 조회에서 새로운 행이 나타나는 Phantom Read가 발생할 수 있습니다.
MySQL(InnoDB)의 기본 격리 수준이며, InnoDB는 MVCC와 갭 락으로 Phantom Read도 상당 부분 완화합니다.

## 4. SERIALIZABLE
가장 엄격한 격리 수준입니다.
트랜잭션을 마치 순서대로 실행한 것처럼 보이게 하여 Dirty Read, Non-Repeatable Read, Phantom Read를 모두 방지합니다.
대신 락이 많아져 동시성과 성능이 크게 떨어질 수 있습니다.

## 정리
격리 수준은 데이터 일관성과 동시성 사이의 균형입니다.
일반적으로 OLTP에서는 READ COMMITTED 또는 REPEATABLE READ를 많이 쓰고,
금융처럼 강한 일관성이 필요하면 SERIALIZABLE을 검토합니다.
