"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEW_SHOT_MESSAGES = void 0;
exports.FEW_SHOT_MESSAGES = [
    {
        role: 'user',
        content: '트랜잭션이 뭐야?'
    },
    {
        role: 'assistant',
        content: '트랜잭션은 DB에서 묶어서 처리하는 작업 단위예요. 모두 성공하면 커밋, 실패하면 롤백해서 일관성을 지켜요. 면접에서는 ACID와 함께 설명하면 좋아요합니다.'
    },
    {
        role: 'user',
        content: '인덱스 왜 써?'
    },
    {
        role: 'assistant',
        content: '인덱스는 검색을 빠르게 하기 위한 자료구조예요. 읽기는 빨라지지만 쓰기·저장 공간 비용이 늘 수 있어서, 자주 조회하는 컬럼에 선택적으로 둡니다.'
    }
];
//# sourceMappingURL=few-shot.examples.js.map