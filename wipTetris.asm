.data
  ; 6*7 board
  BOARD: .space 168
  WIDTH: .word 6
  HEIGHT: .word 7
  ; Memory address of grid position of current piece's tiles
  PIECE_0: .space 4
  PIECE_1: .space 4
  PIECE_2: .space 4
  PIECE_3: .space 4
.text
; Keep in mind that all of these assume that the temporary registers are _temporary_, i.e. once a subroutine is called the values in t0-t9 are unused and can be set however.
  INIT:
    ; Set up board state
    ; Not entirely necessary, but somewhat useful if we want to restart everything
    lw $t0,0,WIDTH
    lw $t1,0,HEIGHT
    mul $t0,$t0,$t1
    li $t1,1
    INIT_CLEAR_LOOP:
      subu $t0,$t0,$t1
      sw $zero,$t0,0
      bne $t0,$zero,INIT_CLEAR_LOOP
    ; The board is now cleared, so we can start setting up our piece
    jal NEW_PIECE
  
  GAME_LOOP:
    jal DRAW_CURRENT
    jal UPDATE_CURRENT
    j GAME_LOOP
    li $a0,10
    syscall

  UPDATE_CURRENT:
    li $t2,0
    li $t3,5
    move $ra,$t4
    la $ra,GAME_LOOP
    UC_LOOP:
      lw $t0,$t2,PIECE_0
      addi $t0,$t0,6
      li $t1,36
      ; Would go past the bottom
      bge $t0,$t1,NEW_PIECE_NON_INIT
      li $t1,1
      lw $t5,$t0,0
      ; Would intersect with another piece
      beq $t5,$t1,NEW_PIECE_NON_INIT       
      li $t1,6
      addi $t2,$t2,1
      blt $t2,$t3,UC_LOOP
    ; We can be confident the path forward is clear
    li $t2,0
    li $t3,5
    UC_LOOP_2:
      lw $t0,$t2,PIECE_0
      sw $zero,$t0,0
      addi $t2,$t2,1
      blt $t2,$t3,UC_LOOP_2
    li $t2,0
    li $t3,5
    UC_LOOP_3:
      lw $t0,$t2,PIECE_0
      addi $t0,$t0,6
      sw $t0,$t2,PIECE_0
      addi $t2,$t2,1
      blt $t2,$t3,UC_LOOP_3
    jr $t4




  DRAW_CURRENT:
    li $t0,2
    lw $t1,$zero,PIECE_0
    sw $t0,$t1,0
    lw $t1,$zero,PIECE_1
    sw $t0,$t1,0
    lw $t1,$zero,PIECE_2
    sw $t0,$t1,0
    lw $t1,$zero,PIECE_3
    sw $t0,$t1,0
    jr $ra

  NEW_PIECE_NON_INIT:
    li $t0,0
    li $t1,3
    li $t2,1
    NPNI_LOOP:
      lw $t3,$t0,PIECE_0
      sw $t2,$t3,0
      addi $t0,$t0,1
      bge $t0,$t1,NPNI_LOOP
  NEW_PIECE:
    ; First, we need a random number to choose which piece we use.
    li $a0,42
    li $a1,7
    syscall
    move $v0,$t0
    li $t1,1
    blt $t0,$t1,PIECE_I
    addi $t1,$t1,1
    blt $t0,$t1,PIECE_J
    addi $t1,$t1,1
    blt $t0,$t1,PIECE_L
    addi $t1,$t1,1
    blt $t0,$t1,PIECE_O
    addi $t1,$t1,1
    blt $t0,$t1,PIECE_S
    addi $t1,$t1,1
    blt $t0,$t1,PIECE_T
    addi $t1,$t1,1
    blt $t0,$t1,PIECE_Z
    PIECE_I:
      li $t0,1
      sw $t0,$zero,PIECE_0
      li $t0,2
      sw $t0,$zero,PIECE_1
      li $t0,3
      sw $t0,$zero,PIECE_2
      li $t0,4
      sw $t0,$zero,PIECE_3
      j NP_END
    PIECE_J:
      li $t0,2
      sw $t0,$zero,PIECE_0
      li $t0,8
      sw $t0,$zero,PIECE_1
      li $t0,9
      sw $t0,$zero,PIECE_2
      li $t0,10
      sw $t0,$zero,PIECE_3
      j NP_END
    PIECE_L:
      li $t0,4
      sw $t0,$zero,PIECE_0
      li $t0,8
      sw $t0,$zero,PIECE_1
      li $t0,9
      sw $t0,$zero,PIECE_2
      li $t0,10
      sw $t0,$zero,PIECE_3
      j NP_END
    PIECE_O:
      li $t0,2
      sw $t0,$zero,PIECE_0
      li $t0,3
      sw $t0,$zero,PIECE_1
      li $t0,8
      sw $t0,$zero,PIECE_2
      li $t0,9
      sw $t0,$zero,PIECE_3
      j NP_END
    PIECE_S:
      li $t0,3
      sw $t0,$zero,PIECE_0
      li $t0,4
      sw $t0,$zero,PIECE_1
      li $t0,8
      sw $t0,$zero,PIECE_2
      li $t0,9
      sw $t0,$zero,PIECE_3
      j NP_END
    PIECE_T:
      li $t0,3
      sw $t0,$zero,PIECE_0
      li $t0,8
      sw $t0,$zero,PIECE_1
      li $t0,9
      sw $t0,$zero,PIECE_2
      li $t0,10
      sw $t0,$zero,PIECE_3
      j NP_END
    PIECE_Z:
      li $t0,2
      sw $t0,$zero,PIECE_0
      li $t0,3
      sw $t0,$zero,PIECE_1
      li $t0,9
      sw $t0,$zero,PIECE_2
      li $t0,10
      sw $t0,$zero,PIECE_3
    NP_END:
    jr $ra

  MEM_INDEX:
    lw $t0,WIDTH,0
    mul $s0,$a1,$t0
    add $s0,$s0,$a0
    jr $ra

