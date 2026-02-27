from accounts.constants import SystemRoles

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def booth_activity_heatmap(request):
    """Get heatmap data: Booth vs Hour of Day (Last 24h)"""
    try:
        user = request.user
        role = getattr(user, 'role', '')
        
        filters = {}
        if role == SystemRoles.ADMIN:
            filters['admin_id'] = user.id
            
        # Default to last 24 hours for hourly heatmap
        now = timezone.now()
        start_time = now - timezone.timedelta(hours=24)
        
        # Aggregate by Booth and Hour
        # TruncHour on verified_at
        activity = (
            Voter.objects.filter(verified_at__gte=start_time, **filters)
            .annotate(hour=TruncHour('verified_at'))
            .values('booth_id', 'hour')
            .annotate(count=Count('id'))
            .order_by('booth_id', 'hour')
        )
        
        # Format for frontend
        data = []
        booths = set()
        
        for entry in activity:
            booth = entry['booth_id']
            hour_str = entry['hour'].strftime('%H:00')
            short_hour = int(entry['hour'].strftime('%H')) # 0-23
            
            data.append({
                'booth': booth,
                'hour': short_hour,
                'time_label': hour_str,
                'count': entry['count']
            })
            booths.add(booth)
            
        # Get Booth Names (Optimize: fetch in bulk)
        # For now, we just return the ID, frontend can maybe map it if it has list, 
        # but better to return names here.
        # Let's fetch Top 10 active booths to keep heatmap readable.
        
        # Organize by Booth
        # We need a defined set of booths to show on Y-axis.
        # Let's pick top 5-8 booths by total activity.
        
        booth_totals = {}
        for d in data:
            bid = d['booth']
            booth_totals[bid] = booth_totals.get(bid, 0) + d['count']
            
        # Sort top 8
        top_booths = sorted(booth_totals.items(), key=lambda x: x[1], reverse=True)[:8]
        top_booth_ids = [b[0] for b in top_booths]
        
        # Filter data for top booths only
        filtered_data = [d for d in data if d['booth'] in top_booth_ids]
        
        return Response({
            'data': filtered_data,
            'booths': top_booth_ids 
        })
    except Exception as e:
        logger.error(f"Heatmap error: {e}")
        return Response({'error': 'Failed to load heatmap'}, status=500)
