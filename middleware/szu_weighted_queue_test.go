package middleware

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSZUWeightedRelaySchedulerUsesFourTwoOneOrder(t *testing.T) {
	scheduler := newSZUWeightedRelayScheduler(1, 32)
	admins := []*szuRelayWaiter{{}, {}, {}, {}}
	teachers := []*szuRelayWaiter{{}, {}}
	students := []*szuRelayWaiter{{}}
	scheduler.queues[szuQueueClassAdmin] = append(scheduler.queues[szuQueueClassAdmin], admins...)
	scheduler.queues[szuQueueClassTeacher] = append(scheduler.queues[szuQueueClassTeacher], teachers...)
	scheduler.queues[szuQueueClassStudent] = append(scheduler.queues[szuQueueClassStudent], students...)

	want := []*szuRelayWaiter{
		admins[0], admins[1], admins[2], admins[3],
		teachers[0], teachers[1], students[0],
	}
	for i, expected := range want {
		assert.Same(t, expected, scheduler.nextWaiterLocked(), "admission %d", i+1)
	}
}

func TestSZUWeightedRelaySchedulerBoundsAndCancelsWaiters(t *testing.T) {
	scheduler := newSZUWeightedRelayScheduler(1, 1)
	release, err := scheduler.acquire(context.Background(), szuQueueClassAdmin)
	require.NoError(t, err)

	waitContext, cancelWait := context.WithCancel(context.Background())
	waitResult := make(chan error, 1)
	go func() {
		_, acquireErr := scheduler.acquire(waitContext, szuQueueClassTeacher)
		waitResult <- acquireErr
	}()
	require.Eventually(t, func() bool {
		scheduler.mu.Lock()
		defer scheduler.mu.Unlock()
		return scheduler.waiting == 1
	}, time.Second, time.Millisecond)

	_, err = scheduler.acquire(context.Background(), szuQueueClassStudent)
	require.ErrorIs(t, err, errSZURelayQueueFull)
	cancelWait()
	require.ErrorIs(t, <-waitResult, context.Canceled)
	release()

	scheduler.mu.Lock()
	defer scheduler.mu.Unlock()
	assert.Equal(t, 0, scheduler.active)
	assert.Equal(t, 0, scheduler.waiting)
}

func TestSZUWeightedRelaySchedulerHonorsQueueTimeout(t *testing.T) {
	scheduler := newSZUWeightedRelayScheduler(1, 2)
	release, err := scheduler.acquire(context.Background(), szuQueueClassAdmin)
	require.NoError(t, err)
	defer release()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()
	_, err = scheduler.acquire(ctx, szuQueueClassStudent)
	require.True(t, errors.Is(err, context.DeadlineExceeded))
}

func TestSZURelayQueueClassSeparatesRBACFromAccountType(t *testing.T) {
	gin.SetMode(gin.TestMode)

	admin, _ := gin.CreateTestContext(nil)
	common.SetContextKey(admin, constant.ContextKeyUserRole, common.RoleAdminUser)
	common.SetContextKey(admin, constant.ContextKeyAccountType, model.AccountTypeStudent)
	class, name := szuRelayQueueClass(admin)
	assert.Equal(t, szuQueueClassAdmin, class)
	assert.Equal(t, "administrator", name)

	teacher, _ := gin.CreateTestContext(nil)
	common.SetContextKey(teacher, constant.ContextKeyUserRole, common.RoleCommonUser)
	common.SetContextKey(teacher, constant.ContextKeyAccountType, model.AccountTypeTeacher)
	class, name = szuRelayQueueClass(teacher)
	assert.Equal(t, szuQueueClassTeacher, class)
	assert.Equal(t, "teacher", name)

	student, _ := gin.CreateTestContext(nil)
	common.SetContextKey(student, constant.ContextKeyUserRole, common.RoleCommonUser)
	class, name = szuRelayQueueClass(student)
	assert.Equal(t, szuQueueClassStudent, class)
	assert.Equal(t, "student", name)
}
