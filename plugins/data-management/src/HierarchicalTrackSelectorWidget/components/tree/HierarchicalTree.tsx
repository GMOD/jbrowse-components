import { useState, useMemo, useEffect, useRef } from 'react'

import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { HierarchicalTrackSelectorModel } from '../../model'

const TreeView = ({
  height,
  model,
}: {
  height: number
  model: HierarchicalTrackSelectorModel
}) => {
  const [expandedItems, setExpandedItems] = useState(
    new Set(['tracks', 'alignments', 'bigwig', 'density']),
  )
  const [checkedItems, setCheckedItems] = useState(
    new Set(['volvox-sorted-bam']),
  )

  // Flatten tree structure for virtualization
  const flattenedItems = useMemo(() => {
    const flatten = (items, result = []) => {
      items.forEach(item => {
        result.push(item)
        if (item.children.length > 0 && expandedItems.has(item.id)) {
          flatten(item.children, result)
        }
      })
      return result
    }

    console.log(model.hierarchy)
    return flatten(model.hierarchy.children)
  }, [expandedItems])

  const parentRef = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(400)

  const itemHeight = 28
  const overscan = 5

  // Calculate visible range
  const { startIndex, endIndex, totalHeight } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const visibleCount = Math.ceil(containerHeight / itemHeight)
    const end = Math.min(
      flattenedItems.length - 1,
      start + visibleCount + overscan * 2,
    )

    return {
      startIndex: start,
      endIndex: end,
      totalHeight: flattenedItems.length * itemHeight,
    }
  }, [scrollTop, containerHeight, flattenedItems.length])

  const handleScroll = e => {
    setScrollTop(e.target.scrollTop)
  }

  useEffect(() => {
    const updateHeight = () => {
      if (parentRef.current) {
        setContainerHeight(parentRef.current.clientHeight)
      }
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [])

  const toggleExpand = itemId => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const toggleCheck = (itemId, e) => {
    e.stopPropagation()
    setCheckedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const TreeItem = ({ item, index }) => {
    const isExpanded = expandedItems.has(item.id)
    const isChecked = checkedItems.has(item.id)
    const hasChildren = item.children.length > 0
    const top = index * itemHeight

    const getItemStyle = () => {
      if (item.type === 'category') {
        return {
          backgroundColor: '#0d9488',
          color: 'white',
          fontWeight: 500,
        }
      }
      return {
        backgroundColor: '#f9fafb',
        color: '#1f2937',
        ':hover': {
          backgroundColor: '#f3f4f6',
        },
      }
    }

    const getPaddingLeft = () => {
      if (item.type === 'category') return 8
      return item.depth === 1 ? 32 : 56
    }

    const baseStyle = getItemStyle()
    const iconColor =
      item.type === 'section' || item.type === 'subsection'
        ? 'white'
        : '#4b5563'
    const textColor =
      item.type === 'section' || item.type === 'subsection'
        ? 'white'
        : '#1f2937'
    const moreIconColor =
      item.type === 'section' || item.type === 'subsection'
        ? 'white'
        : '#9ca3af'

    return (
      <div
        style={{
          position: 'absolute',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          borderBottom: '1px solid #e5e7eb',
          height: `${itemHeight}px`,
          top: `${top}px`,
          left: 0,
          ...baseStyle,
        }}
        onClick={() => hasChildren && toggleExpand(item.id)}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            paddingTop: '0.25rem',
            paddingBottom: '0.25rem',
            paddingLeft: `${getPaddingLeft()}px`,
            paddingRight: '0.5rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              minWidth: 0,
              flex: 1,
            }}
          >
            {hasChildren && (
              <div style={{ flexShrink: 0 }}>
                {isExpanded ? (
                  <ArrowDropDownIcon style={{ color: iconColor }} />
                ) : (
                  <ArrowRightIcon style={{ color: iconColor }} />
                )}
              </div>
            )}

            {item.type !== 'category' && (
              <input
                type="checkbox"
                checked={isChecked}
                onChange={e => toggleCheck(item.id, e)}
                style={{
                  width: '0.75rem',
                  height: '0.75rem',
                  border: '1px solid #d1d5db',
                  flexShrink: 0,
                }}
                onClick={e => e.stopPropagation()}
              />
            )}

            <span
              style={{
                fontSize: '0.75rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: textColor,
              }}
            >
              {item.name}
            </span>

            <div style={{ flexShrink: 0, marginLeft: 'auto' }}>
              <MoreHorizIcon style={{ color: moreIconColor }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '28rem', marginLeft: 'auto', marginRight: 'auto' }}>
      <div
        style={{
          backgroundColor: 'white',
          boxShadow:
            '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          border: '1px solid #d1d5db',
          overflow: 'hidden',
        }}
      >
        <div
          ref={parentRef}
          style={{
            height,
            overflowY: 'auto',
            backgroundColor: 'white',
            contain: 'strict',
          }}
          onScroll={handleScroll}
        >
          <div
            style={{
              height: `${totalHeight}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {Array.from({ length: endIndex - startIndex + 1 }, (_, i) => {
              const index = startIndex + i
              const item = flattenedItems[index]
              if (!item) return null

              return <TreeItem key={item.id} item={item} index={index} />
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TreeView
