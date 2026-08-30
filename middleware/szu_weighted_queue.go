package middleware

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const (
	szuQueueClassAdmin = iota
	szuQueueClassTeacher
	szuQueueClassStudent
)

var (
	errSZURelayQueueFull = errors.New("relay queue is full")

	// Under contention every seven admissions follow administrator/teacher/
	// student = 4/2/1. Empty classes are skipped without wasting capacity.
	szuQueueSchedule = [...]int{
		szuQueueClassAdmin,
		szuQueueClassAdmin,
		szuQueueClassAdmin,
		szuQueueClassAdmin,
		szuQueueClassTeacher,
		szuQueueClassTeacher,
		szuQueueClassStudent,
	}
)

type szuRelayWaiter struct {
	ready     chan struct{}
	granted   bool
	cancelled bool
}

type szuWeightedRelayScheduler struct {
	mu         sync.Mutex
	maxActive  int
	maxWaiting int
	active     int
	waiting    int
	cursor     int
	queues     [3][]*szuRelayWaiter
}

func newSZUWeightedRelayScheduler(maxActive, maxWaiting int) *szuWeightedRelayScheduler {
	if maxActive < 1 {
		maxActive = 1
	}
	if maxWaiting < 1 {
		maxWaiting = 1
	}
	return &szuWeightedRelayScheduler{
		maxActive:  maxActive,
		maxWaiting: maxWaiting,
	}
}

func (s *szuWeightedRelayScheduler) acquire(ctx context.Context, class int) (func(), error) {
	if ctx == nil {
		ctx = context.Background()
	}
	if class < szuQueueClassAdmin || class > szuQueueClassStudent {
		class = szuQueueClassStudent
	}

	s.mu.Lock()
	if s.active < s.maxActive && s.waiting == 0 {
		s.active++
		s.mu.Unlock()
		return s.releaseFunc(), nil
	}
	if s.waiting >= s.maxWaiting {
		s.mu.Unlock()
		return nil, errSZURelayQueueFull
	}
	waiter := &szuRelayWaiter{ready: make(chan struct{})}
	s.queues[class] = append(s.queues[class], waiter)
	s.waiting++
	s.mu.Unlock()

	select {
	case <-waiter.ready:
		return s.releaseFunc(), nil
	case <-ctx.Done():
		s.mu.Lock()
		if waiter.granted {
			s.mu.Unlock()
			s.release()
			return nil, ctx.Err()
		}
		if !waiter.cancelled {
			waiter.cancelled = true
			s.waiting--
		}
		s.mu.Unlock()
		return nil, ctx.Err()
	}
}

func (s *szuWeightedRelayScheduler) releaseFunc() func() {
	var once sync.Once
	return func() {
		once.Do(s.release)
	}
}

func (s *szuWeightedRelayScheduler) release() {
	s.mu.Lock()
	if s.active > 0 {
		s.active--
	}
	s.dispatchLocked()
	s.mu.Unlock()
}

func (s *szuWeightedRelayScheduler) dispatchLocked() {
	for s.active < s.maxActive && s.waiting > 0 {
		waiter := s.nextWaiterLocked()
		if waiter == nil {
			return
		}
		waiter.granted = true
		s.waiting--
		s.active++
		close(waiter.ready)
	}
}

func (s *szuWeightedRelayScheduler) nextWaiterLocked() *szuRelayWaiter {
	for attempts := 0; attempts < len(szuQueueSchedule); attempts++ {
		class := szuQueueSchedule[s.cursor]
		s.cursor = (s.cursor + 1) % len(szuQueueSchedule)
		queue := s.queues[class]
		for len(queue) > 0 {
			waiter := queue[0]
			queue = queue[1:]
			s.queues[class] = queue
			if waiter.cancelled {
				continue
			}
			return waiter
		}
	}
	return nil
}

var szuRelayScheduler = newSZUWeightedRelayScheduler(
	common.GetEnvOrDefault("SZU_RELAY_MAX_CONCURRENCY", 1),
	common.GetEnvOrDefault("SZU_RELAY_QUEUE_SIZE", 512),
)

var szuRelayQueueTimeout = time.Duration(
	common.GetEnvOrDefault("SZU_RELAY_QUEUE_TIMEOUT_SECONDS", 600),
) * time.Second

func szuRelayQueueClass(c *gin.Context) (int, string) {
	role := common.GetContextKeyInt(c, constant.ContextKeyUserRole)
	if role >= common.RoleAdminUser {
		return szuQueueClassAdmin, "administrator"
	}
	if common.GetContextKeyString(c, constant.ContextKeyAccountType) == model.AccountTypeTeacher {
		return szuQueueClassTeacher, "teacher"
	}
	return szuQueueClassStudent, "student"
}

// SZUWeightedRelayQueue limits concurrent inference requests and admits queued
// requests with administrator/teacher/student weights of 4/2/1.
func SZUWeightedRelayQueue() gin.HandlerFunc {
	return func(c *gin.Context) {
		class, className := szuRelayQueueClass(c)
		queueContext := c.Request.Context()
		cancel := func() {}
		if szuRelayQueueTimeout > 0 {
			queueContext, cancel = context.WithTimeout(queueContext, szuRelayQueueTimeout)
		}
		defer cancel()

		startedAt := time.Now()
		release, err := szuRelayScheduler.acquire(queueContext, class)
		if err != nil {
			if errors.Is(err, errSZURelayQueueFull) {
				abortWithOpenAiMessage(c, http.StatusTooManyRequests, "Inference queue is full, please retry later")
				return
			}
			abortWithOpenAiMessage(c, http.StatusGatewayTimeout, "Timed out while waiting for inference capacity")
			return
		}
		defer release()

		c.Header("X-SZU-Queue-Class", className)
		c.Header("X-SZU-Queue-Wait-Ms", strconv.FormatInt(time.Since(startedAt).Milliseconds(), 10))
		c.Next()
	}
}
